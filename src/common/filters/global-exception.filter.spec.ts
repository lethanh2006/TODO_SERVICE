import {
  BadRequestException,
  type ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import {
  handleOriginHttpException,
  type HttpBoundaryContext,
} from '@nrapp/observability';
import type { RequestWithContext } from '../interfaces/request-context.interface';
import type { StructuredLoggerService } from '../observability/structured-logger.service';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  const reply = jest.fn();
  const logError = jest.fn();
  const adapterHost = {
    httpAdapter: { reply },
  } as unknown as HttpAdapterHost;
  const logger = {
    handleHttpException: (exception: unknown, context: HttpBoundaryContext) =>
      handleOriginHttpException(
        { error: logError } as never,
        exception,
        context,
      ),
  } as unknown as StructuredLoggerService;
  const request = {
    method: 'POST',
    url: '/api/todo',
    originalUrl: '/api/todo',
    headers: {},
    requestContext: {
      requestId: 'req-filter-123',
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

  it('merge requestId thực vào object response của lỗi 4xx', () => {
    const filter = new GlobalExceptionFilter(adapterHost, logger);

    filter.catch(
      new BadRequestException({
        message: 'Dữ liệu không hợp lệ',
        code: 'TASK_INVALID',
        requestId: 'spoofed',
      }),
      host,
    );

    expect(reply).toHaveBeenCalledWith(
      response,
      {
        statusCode: 400,
        code: 'TASK_INVALID',
        message: 'Dữ liệu không hợp lệ',
        requestId: 'req-filter-123',
      },
      400,
    );
  });

  it('không trả raw message hoặc field nội bộ của HttpException 5xx', () => {
    const filter = new GlobalExceptionFilter(adapterHost, logger);

    filter.catch(
      new HttpException(
        {
          message: 'Mongo authentication failed',
          error: 'mongodb://user:secret@host/database',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      ),
      host,
    );

    expect(reply).toHaveBeenCalledWith(
      response,
      {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId: 'req-filter-123',
        errorId: expect.any(String),
      },
      500,
    );
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        'event.name': 'http.request.failed',
        request_id: 'req-filter-123',
        'http.response.status_code': 500,
      }),
      'Unexpected application error',
    );
  });

  it('ẩn message của lỗi không xác định', () => {
    const filter = new GlobalExceptionFilter(adapterHost, logger);

    filter.catch(new Error('private database detail'), host);

    expect(reply).toHaveBeenCalledWith(
      response,
      {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId: 'req-filter-123',
        errorId: expect.any(String),
      },
      500,
    );
  });
});
