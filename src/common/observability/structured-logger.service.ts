export type LogDetails = Record<string, unknown>;

/**
 * Xuất một JSON object trên mỗi dòng stdout/stderr để log collector đọc.
 * Alert Telegram/Discord được cấu hình ở tầng monitoring, không gọi tại đây.
 */
export class StructuredLoggerService {
    info(event: string, details: LogDetails): void {
        console.log(this.serialize(event, details));
    }

    warn(event: string, details: LogDetails): void {
        console.warn(this.serialize(event, details));
    }

    error(event: string, details: LogDetails, stack?: string): void {
        console.error(this.serialize(event, {
            ...details,
            ...(stack ? { stack } : {}),
        }));
    }

    private serialize(event: string, details: LogDetails): string {
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            service: "todo",
            event,
            ...details,
        });
    }
}

export const structuredLogger = new StructuredLoggerService();
