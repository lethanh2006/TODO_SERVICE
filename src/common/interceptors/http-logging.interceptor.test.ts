import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { Response } from "express";
import type { RequestWithContext } from "../interfaces/request-context.interface.js";
import type {
    LogDetails,
    StructuredLoggerService,
} from "../observability/structured-logger.service.js";
import { createHttpLoggingInterceptor } from "./http-logging.interceptor.js";

interface CapturedLog {
    event: string;
    details: LogDetails;
    level: "error" | "info" | "warn";
}

const runInterceptor = (statusCode: number) => {
    const captured: CapturedLog[] = [];
    const logger = {
        info: (event: string, details: LogDetails) => captured.push({ event, details, level: "info" }),
        warn: (event: string, details: LogDetails) => captured.push({ event, details, level: "warn" }),
        error: (event: string, details: LogDetails) => captured.push({ event, details, level: "error" }),
    } as unknown as StructuredLoggerService;
    const request = {
        headers: { "x-request-id": "request-123" },
        method: "GET",
        originalUrl: "/api/todo",
        requestContext: {
            requestId: "request-123",
            startedAt: process.hrtime.bigint(),
        },
        user: { _id: "user-123" },
    } as unknown as RequestWithContext;
    const response = new EventEmitter() as EventEmitter & Response;
    response.statusCode = statusCode;
    response.locals = {};
    let nextCalls = 0;

    createHttpLoggingInterceptor(logger)(
        request,
        response,
        () => {
            nextCalls += 1;
        },
    );
    response.emit("finish");

    return { captured, nextCalls };
};

test("ghi log completed đầy đủ field cho response thành công", () => {
    const result = runInterceptor(200);

    assert.equal(result.nextCalls, 1);
    assert.equal(result.captured.length, 1);
    assert.equal(result.captured[0]?.level, "info");
    assert.equal(result.captured[0]?.event, "http_request_completed");
    assert.deepEqual(
        {
            ...result.captured[0]?.details,
            durationMs: typeof result.captured[0]?.details.durationMs,
        },
        {
            requestId: "request-123",
            userId: "user-123",
            method: "GET",
            path: "/api/todo",
            statusCode: 200,
            durationMs: "number",
        },
    );
});

test("ghi log rejected ở warn cho response 4xx", () => {
    const result = runInterceptor(404);

    assert.equal(result.captured[0]?.level, "warn");
    assert.equal(result.captured[0]?.event, "http_request_rejected");
    assert.equal(result.captured[0]?.details.statusCode, 404);
});

test("ghi log failed ở stderr cho response 5xx", () => {
    const result = runInterceptor(500);

    assert.equal(result.captured[0]?.level, "error");
    assert.equal(result.captured[0]?.event, "http_request_failed");
    assert.equal(result.captured[0]?.details.statusCode, 500);
});
