import type { NextFunction, RequestHandler, Response } from "express";
import type { RequestWithContext } from "../interfaces/request-context.interface.js";
import {
    structuredLogger,
    type LogDetails,
    type StructuredLoggerService,
} from "../observability/structured-logger.service.js";

interface RequestUser {
    _id?: unknown;
    id?: unknown;
}

type RequestWithUser = RequestWithContext & { user?: RequestUser | null };

const logDetails = (request: RequestWithUser, response: Response): LogDetails => {
    const requestContext = request.requestContext;
    const userId = request.user?._id ?? request.user?.id;

    return {
        requestId: requestContext?.requestId ?? "unknown",
        ...(userId !== undefined && userId !== null ? { userId: String(userId) } : {}),
        method: request.method,
        path: request.originalUrl ?? request.url,
        statusCode: response.statusCode,
        durationMs: requestContext
            ? Number(process.hrtime.bigint() - requestContext.startedAt) / 1e6
            : 0,
    };
};

export const createHttpLoggingInterceptor = (
    logger: StructuredLoggerService = structuredLogger,
): RequestHandler => (
    request,
    response,
    next: NextFunction,
): void => {
    response.once("finish", () => {
        if (response.locals.requestErrorLogged === true) return;

        const details = logDetails(request as RequestWithUser, response);
        if (response.statusCode >= 500) {
            logger.error("http_request_failed", details);
        } else if (response.statusCode >= 400) {
            logger.warn("http_request_rejected", details);
        } else {
            logger.info("http_request_completed", details);
        }
    });

    next();
};

export const httpLoggingInterceptor = createHttpLoggingInterceptor();
