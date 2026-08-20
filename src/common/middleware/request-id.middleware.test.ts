import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Response } from "express";
import type { RequestWithContext } from "../interfaces/request-context.interface.js";
import {
    requestIdMiddleware,
    SAFE_REQUEST_ID,
} from "./request-id.middleware.js";

const runMiddleware = (incomingRequestId?: string) => {
    const request = {
        headers: incomingRequestId === undefined
            ? {}
            : { "x-request-id": incomingRequestId },
    } as unknown as RequestWithContext;
    const responseHeaders = new Map<string, string>();
    const response = {
        setHeader: (name: string, value: string) => {
            responseHeaders.set(name, value);
            return response;
        },
    } as unknown as Response;
    let nextCalls = 0;

    requestIdMiddleware(
        request,
        response,
        (() => {
            nextCalls += 1;
        }) as NextFunction,
    );

    return { nextCalls, request, responseHeaders };
};

test("giữ nguyên x-request-id hợp lệ", () => {
    const result = runMiddleware("gateway-request_123:abc");

    assert.equal(result.request.requestContext?.requestId, "gateway-request_123:abc");
    assert.equal(result.request.headers["x-request-id"], "gateway-request_123:abc");
    assert.equal(result.responseHeaders.get("x-request-id"), "gateway-request_123:abc");
    assert.equal(typeof result.request.requestContext?.startedAt, "bigint");
    assert.equal(result.nextCalls, 1);
});

test("tự sinh request ID khi không có header", () => {
    const result = runMiddleware();
    const requestId = result.request.requestContext?.requestId;

    assert.equal(typeof requestId, "string");
    assert.match(requestId ?? "", SAFE_REQUEST_ID);
    assert.equal(result.responseHeaders.get("x-request-id"), requestId);
    assert.equal(result.nextCalls, 1);
});

test("thay request ID sai định dạng và vẫn cho request đi tiếp", () => {
    const unsafeRequestId = "../../unsafe request-id";
    const result = runMiddleware(unsafeRequestId);
    const requestId = result.request.requestContext?.requestId;

    assert.notEqual(requestId, unsafeRequestId);
    assert.match(requestId ?? "", SAFE_REQUEST_ID);
    assert.equal(result.request.headers["x-request-id"], requestId);
    assert.equal(result.responseHeaders.get("x-request-id"), requestId);
    assert.equal(result.nextCalls, 1);
});
