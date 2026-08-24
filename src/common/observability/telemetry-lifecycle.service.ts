import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { shutdownTelemetry } from "@nrapp/observability";
import { todoAppLogger } from "./structured-logger.service";

@Injectable()
export class TelemetryLifecycleService implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    try {
      todoAppLogger.flush();
    } finally {
      await shutdownTelemetry(2_000);
    }
  }
}
