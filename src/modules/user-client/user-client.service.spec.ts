import {
  BadGatewayException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { StructuredLoggerService } from "../../common/observability/structured-logger.service";
import { UserClientService } from "./user-client.service";

describe("UserClientService", () => {
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
      if (key === "USER_SERVICE_URL") return "http://user:5000/";
      if (key === "USER_SERVICE_TIMEOUT_MS") return "1250";
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

  it("forward request-id và timeout khi kiểm tra user", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    const service = new UserClientService(config, logger);

    await expect(service.exists("user/id", "req-123")).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://user:5000/api/user/internal/user%2Fid",
      {
        headers: { "x-request-id": "req-123" },
        signal: expect.any(AbortSignal),
      },
    );
    expect(logInfo).toHaveBeenCalledWith(
      "user_service_request_completed",
      expect.objectContaining({
        requestId: "req-123",
        operation: "user_exists",
        statusCode: 200,
      }),
    );
  });

  it("chỉ coi 404 là user không tồn tại", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    const service = new UserClientService(config, logger);

    await expect(service.exists("missing", "req-404")).resolves.toBe(false);
  });

  it("map lỗi 5xx upstream thành 503", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const service = new UserClientService(config, logger);

    await expect(service.exists("user", "req-500")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("map phản hồi 4xx bất thường thành 502", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const service = new UserClientService(config, logger);

    await expect(service.exists("user", "req-401")).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it("map timeout hoặc lỗi mạng thành 503 và log request-id", async () => {
    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";
    fetchMock.mockRejectedValue(timeout);
    const service = new UserClientService(config, logger);

    await expect(service.exists("user", "req-timeout")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(logWarn).toHaveBeenCalledWith(
      "user_service_request_failed",
      expect.objectContaining({
        requestId: "req-timeout",
        operation: "user_exists",
        statusCode: 503,
        errorName: "TimeoutError",
      }),
    );
  });
});
