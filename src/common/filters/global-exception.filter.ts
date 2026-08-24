import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import type { RequestWithContext } from "../interfaces/request-context.interface";
import { StructuredLoggerService } from "../observability/structured-logger.service";
import { toError } from "../utils/error.util";

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly logger: StructuredLoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const requestId = request.requestContext?.requestId ?? "unknown";
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const error = toError(exception);
    const details = {
      requestId,
      userId: request.user?._id ?? request.user?.id,
      method: request.method,
      path: request.originalUrl ?? request.url,
      statusCode,
      durationMs: request.requestContext
        ? Number(process.hrtime.bigint() - request.requestContext.startedAt) /
          1e6
        : 0,
      errorName: error.name,
      message: error.message,
    };
    if (statusCode >= 500)
      this.logger.error("http_request_failed", details, error.stack);
    else this.logger.warn("http_request_rejected", details);

    const exceptionBody =
      exception instanceof HttpException ? exception.getResponse() : null;
    const responseBody = this.safeResponseBody(
      exceptionBody,
      statusCode,
      requestId,
    );
    this.adapterHost.httpAdapter.reply(
      http.getResponse(),
      responseBody,
      statusCode,
    );
  }

  private safeResponseBody(
    exceptionBody: string | object | null,
    statusCode: number,
    requestId: string,
  ): Record<string, unknown> {
    if (statusCode >= 500) {
      return {
        statusCode,
        message: "Internal server error",
        requestId,
      };
    }
    if (
      exceptionBody !== null &&
      typeof exceptionBody === "object" &&
      !Array.isArray(exceptionBody)
    ) {
      return { ...exceptionBody, requestId };
    }
    return {
      statusCode,
      message: exceptionBody ?? "Request rejected",
      requestId,
    };
  }
}
