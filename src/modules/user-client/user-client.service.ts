import {
  BadGatewayException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac } from "node:crypto";
import { StructuredLoggerService } from "../../common/observability/structured-logger.service";
import { toError } from "../../common/utils/error.util";

type TaskRow = Record<string, any>;

const DIRECTORY_PATH = "/api/user/user/all";
const FORBIDDEN_INTERNAL_SECRETS = new Set([
  "replace_with_at_least_32_random_characters",
  "your-super-secret-key-chatapp",
  "your_jwt_secret_here",
]);

@Injectable()
export class UserClientService {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly userInternalSecret: string;

  constructor(
    config: ConfigService,
    private readonly logger: StructuredLoggerService,
  ) {
    this.baseUrl = (
      config.get<string>("USER_SERVICE_URL") ??
      config.get<string>("USER_SERVICE") ??
      "http://localhost:5000"
    ).replace(/\/+$/, "");
    this.timeoutMs = this.parseTimeout(
      config.get<string | number>("USER_SERVICE_TIMEOUT_MS"),
    );
    this.userInternalSecret = this.requireInternalSecret(
      config.get<string>("USER_INTERNAL_SECRET"),
    );
  }

  async exists(userId: string, requestId: string): Promise<boolean> {
    const response = await this.request(
      `/api/user/internal/${encodeURIComponent(userId)}`,
      { headers: { "x-request-id": requestId } },
      { operation: "user_exists", requestId, allowNotFound: true },
    );
    return response.status !== 404;
  }

  async enrichTasks(
    tasks: TaskRow[],
    userPayload: string | undefined,
    requestId: string,
  ): Promise<TaskRow[]> {
    if (tasks.length === 0 || !userPayload) return tasks;

    try {
      const response = await this.request(
        DIRECTORY_PATH,
        {
          headers: this.signedDirectoryHeaders(userPayload, requestId),
        },
        { operation: "enrich_tasks", requestId },
      );
      const payload = (await response.json()) as { users?: unknown };
      if (!Array.isArray(payload.users)) {
        this.logger.warn("user_service_payload_invalid", {
          requestId,
          operation: "enrich_tasks",
          statusCode: 502,
        });
        return tasks;
      }
      const users = new Map(
        payload.users.map((raw) => {
          const user = raw as Record<string, any>;
          return [
            String(user._id),
            { _id: user._id, username: user.username, email: user.email },
          ];
        }),
      );
      return tasks.map((task) => ({
        ...task,
        createdBy: users.get(String(task.createdBy)) ?? task.createdBy,
        assignedTo: users.get(String(task.assignedTo)) ?? task.assignedTo,
      }));
    } catch (error: unknown) {
      this.logger.warn("user_service_enrichment_skipped", {
        requestId,
        operation: "enrich_tasks",
        statusCode: error instanceof HttpException ? error.getStatus() : 502,
        errorName: toError(error).name,
      });
      return tasks;
    }
  }

  private async request(
    path: string,
    init: RequestInit,
    context: {
      operation: string;
      requestId: string;
      allowNotFound?: boolean;
    },
  ): Promise<Response> {
    const startedAt = process.hrtime.bigint();
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const details = {
        requestId: context.requestId,
        operation: context.operation,
        statusCode: response.status,
        durationMs: this.durationMs(startedAt),
      };

      if (response.status >= 500 || response.status === 429) {
        this.logger.warn("user_service_unavailable", details);
        throw new ServiceUnavailableException({
          message: "Dịch vụ người dùng tạm thời không khả dụng",
        });
      }
      if (!response.ok && !(context.allowNotFound && response.status === 404)) {
        this.logger.warn("user_service_bad_response", details);
        throw new BadGatewayException({
          message: "Phản hồi từ dịch vụ người dùng không hợp lệ",
        });
      }

      this.logger.info("user_service_request_completed", details);
      return response;
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      this.logger.warn("user_service_request_failed", {
        requestId: context.requestId,
        operation: context.operation,
        statusCode: 503,
        durationMs: this.durationMs(startedAt),
        errorName: toError(error).name,
      });
      throw new ServiceUnavailableException({
        message: "Không kết nối được dịch vụ người dùng",
      });
    }
  }

  private parseTimeout(value: string | number | undefined): number {
    const timeoutMs = Number(value ?? 3000);
    return Number.isFinite(timeoutMs) && timeoutMs > 0
      ? Math.min(Math.trunc(timeoutMs), 60_000)
      : 3000;
  }

  private requireInternalSecret(value: string | undefined): string {
    const secret = value?.trim();
    if (
      !secret ||
      Buffer.byteLength(secret) < 32 ||
      FORBIDDEN_INTERNAL_SECRETS.has(secret.toLowerCase())
    ) {
      throw new Error("USER_INTERNAL_SECRET phải có ít nhất 32 byte");
    }
    return secret;
  }

  private signedDirectoryHeaders(
    payload: string,
    requestId: string,
  ): Record<string, string> {
    const timestamp = Date.now().toString();
    const context = `GET:${DIRECTORY_PATH}`;
    const signature = createHmac("sha256", this.userInternalSecret)
      .update(`${timestamp}.${requestId}.${payload}.${context}`)
      .digest("hex");
    return {
      "x-request-id": requestId,
      "x-user-payload": payload,
      "x-user-timestamp": timestamp,
      "x-user-signature": signature,
    };
  }

  private durationMs(startedAt: bigint): number {
    return Number(process.hrtime.bigint() - startedAt) / 1e6;
  }
}
