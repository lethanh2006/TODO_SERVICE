import { randomUUID } from "node:crypto";
import type { NextFunction, Response } from "express";
import type { RequestWithContext } from "../interfaces/request-context.interface.js";

export const REQUEST_ID_HEADER = "x-request-id";
export const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export const requestIdMiddleware = (
    request: RequestWithContext,
    response: Response,
    next: NextFunction,
): void => {
    const incomingRequestId = request.headers[REQUEST_ID_HEADER];
    const requestId =
        typeof incomingRequestId === "string" && SAFE_REQUEST_ID.test(incomingRequestId)
            ? incomingRequestId
            : randomUUID();

    request.requestContext = {
        requestId,
        startedAt: process.hrtime.bigint(),
    };
    request.headers[REQUEST_ID_HEADER] = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);
    next();
};
