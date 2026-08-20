import type { ErrorRequestHandler } from "express";
import type { RequestWithContext } from "../interfaces/request-context.interface.js";
import {
    structuredLogger,
    type StructuredLoggerService,
} from "../observability/structured-logger.service.js";
import { toError } from "../utils/error.util.js";

interface HttpErrorLike {
    status?: unknown;
    statusCode?: unknown;
}

interface RequestUser {
    _id?: unknown;
    id?: unknown;
}

type RequestWithUser = RequestWithContext & { user?: RequestUser | null };

const validStatusCode = (value: unknown): value is number =>
    typeof value === "number" && Number.isInteger(value) && value >= 400 && value <= 599;

const statusFrom = (exception: unknown): number => {
    if (typeof exception !== "object" || exception === null) return 500;
    const candidate = exception as HttpErrorLike;
    if (validStatusCode(candidate.status)) return candidate.status;
    if (validStatusCode(candidate.statusCode)) return candidate.statusCode;
    return 500;
};

export const createGlobalExceptionFilter = (
    logger: StructuredLoggerService = structuredLogger,
): ErrorRequestHandler => (
    exception,
    request,
    response,
    next,
): void => {
    if (response.headersSent) {
        next(exception);
        return;
    }

    const typedRequest = request as RequestWithUser;
    const requestContext = typedRequest.requestContext;
    const statusCode = statusFrom(exception);
    const error = toError(exception);
    const userId = typedRequest.user?._id ?? typedRequest.user?.id;
    const details = {
        requestId: requestContext?.requestId ?? "unknown",
        ...(userId !== undefined && userId !== null ? { userId: String(userId) } : {}),
        method: request.method,
        path: request.originalUrl ?? request.url,
        statusCode,
        durationMs: requestContext
            ? Number(process.hrtime.bigint() - requestContext.startedAt) / 1e6
            : 0,
        errorName: error.name,
        message: error.message,
    };

    response.locals.requestErrorLogged = true;
    if (statusCode >= 500) {
        logger.error("http_request_failed", details, error.stack);
    } else {
        logger.warn("http_request_rejected", details);
    }

    response.status(statusCode).json({
        statusCode,
        message: statusCode >= 500 ? "Internal server error" : error.message,
        requestId: requestContext?.requestId ?? "unknown",
    });
};

export const globalExceptionFilter = createGlobalExceptionFilter();
