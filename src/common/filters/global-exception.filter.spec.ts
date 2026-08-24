import {
  BadRequestException,
  type ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { HttpAdapterHost } from "@nestjs/core";
import type { RequestWithContext } from "../interfaces/request-context.interface";
import type { StructuredLoggerService } from "../observability/structured-logger.service";
import { GlobalExceptionFilter } from "./global-exception.filter";

describe("GlobalExceptionFilter", () => {
  const reply = jest.fn();
  const logError = jest.fn();
  const adapterHost = {
    httpAdapter: { reply },
  } as unknown as HttpAdapterHost;
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: logError,
  } as unknown as StructuredLoggerService;
  const request = {
    method: "POST",
    url: "/api/todo",
    originalUrl: "/api/todo",
    headers: {},
    requestContext: {
      requestId: "req-filter-123",
      startedAt: process.hrtime.bigint(),
    },
  } as unknown as RequestWithContext;
  const response = {};
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("merge requestId thực vào object response của lỗi 4xx", () => {
    const filter = new GlobalExceptionFilter(adapterHost, logger);

    filter.catch(
      new BadRequestException({
        message: "Dữ liệu không hợp lệ",
        code: "TASK_INVALID",
        requestId: "spoofed",
      }),
      host,
    );

    expect(reply).toHaveBeenCalledWith(
      response,
      {
        message: "Dữ liệu không hợp lệ",
        code: "TASK_INVALID",
        requestId: "req-filter-123",
      },
      400,
    );
  });

  it("không trả raw message hoặc field nội bộ của HttpException 5xx", () => {
    const filter = new GlobalExceptionFilter(adapterHost, logger);

    filter.catch(
      new HttpException(
        {
          message: "Mongo authentication failed",
          error: "mongodb://user:secret@host/database",
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      ),
      host,
    );

    expect(reply).toHaveBeenCalledWith(
      response,
      {
        statusCode: 500,
        message: "Internal server error",
        requestId: "req-filter-123",
      },
      500,
    );
    expect(logError).toHaveBeenCalledWith(
      "http_request_failed",
      expect.objectContaining({
        requestId: "req-filter-123",
        statusCode: 500,
      }),
      expect.any(String),
    );
  });

  it("ẩn message của lỗi không xác định", () => {
    const filter = new GlobalExceptionFilter(adapterHost, logger);

    filter.catch(new Error("private database detail"), host);

    expect(reply).toHaveBeenCalledWith(
      response,
      {
        statusCode: 500,
        message: "Internal server error",
        requestId: "req-filter-123",
      },
      500,
    );
  });
});
