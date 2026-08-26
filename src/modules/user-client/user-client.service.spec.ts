import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type { StructuredLoggerService } from '../../common/observability/structured-logger.service';
import { UserClientService } from './user-client.service';

describe('UserClientService', () => {
  const userInternalSecret = '0123456789abcdef0123456789abcdef';
  const originalFetch = globalThis.fetch;
  const fetchMock = jest.fn();
  const logInfo = jest.fn();
  const logWarn = jest.fn();
  const logger = {
    info: logInfo,
    warn: logWarn,
    error: jest.fn(),
  } as unknown as StructuredLoggerService;
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'USER_SERVICE_URL') return 'http://user:5000/';
      if (key === 'USER_SERVICE_TIMEOUT_MS') return '1250';
      if (key === 'USER_INTERNAL_SECRET') return userInternalSecret;
      return undefined;
    }),
  } as unknown as ConfigService;

  beforeAll(() => {
    globalThis.fetch = fetchMock;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('forward request-id và timeout mà không tạo success log', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const service = new UserClientService(config, logger);

    await expect(service.exists('user/id', 'req-123')).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://user:5000/api/user/internal/user%2Fid',
      {
        headers: { 'x-request-id': 'req-123' },
        signal: expect.any(AbortSignal),
      },
    );
    expect(logInfo).not.toHaveBeenCalled();
  });

  it('chỉ coi 404 là user không tồn tại', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    const service = new UserClientService(config, logger);

    await expect(service.exists('missing', 'req-404')).resolves.toBe(false);
  });

  it('map lỗi 5xx upstream thành 503', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const service = new UserClientService(config, logger);

    await expect(service.exists('user', 'req-500')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('map phản hồi 4xx bất thường thành 502', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const service = new UserClientService(config, logger);

    await expect(service.exists('user', 'req-401')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('map timeout thành 503, giữ cause và không log trước boundary', async () => {
    const timeout = new Error('timed out');
    timeout.name = 'TimeoutError';
    fetchMock.mockRejectedValue(timeout);
    const service = new UserClientService(config, logger);

    const error = await service
      .exists('user', 'req-timeout')
      .catch((caught: unknown) => caught as ServiceUnavailableException);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.cause).toBe(timeout);
    expect(logWarn).not.toHaveBeenCalled();
  });

  it('ký payload khi lấy danh bạ để enrich task', async () => {
    const timestamp = 1_700_000_000_000;
    const userPayload = Buffer.from(
      JSON.stringify({ _id: 'manager-id', role: 'manager' }),
    ).toString('base64');
    jest.spyOn(Date, 'now').mockReturnValue(timestamp);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        users: [{ _id: 'employee-id', username: 'Nguyễn An' }],
      }),
    });
    const service = new UserClientService(config, logger);

    await expect(
      service.enrichTasks(
        [{ _id: 'task-id', assignedTo: 'employee-id' }],
        userPayload,
        'req-directory',
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        assignedTo: expect.objectContaining({
          _id: 'employee-id',
          username: 'Nguyễn An',
        }),
      }),
    ]);

    const expectedSignature = createHmac('sha256', userInternalSecret)
      .update(
        `${timestamp}.req-directory.${userPayload}.GET:/api/user/user/all`,
      )
      .digest('hex');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://user:5000/api/user/user/all',
      expect.objectContaining({
        headers: {
          'x-request-id': 'req-directory',
          'x-user-payload': userPayload,
          'x-user-timestamp': String(timestamp),
          'x-user-signature': expectedSignature,
        },
      }),
    );
  });

  it('dừng khởi động khi secret gọi User không an toàn', () => {
    const unsafeConfig = {
      get: jest.fn((key: string) =>
        key === 'USER_INTERNAL_SECRET' ? 'too-short' : undefined,
      ),
    } as unknown as ConfigService;

    expect(() => new UserClientService(unsafeConfig, logger)).toThrow(
      'USER_INTERNAL_SECRET phải có ít nhất 32 byte',
    );
  });
});
