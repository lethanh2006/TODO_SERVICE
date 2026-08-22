import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type TaskRow = Record<string, any>;

@Injectable()
export class UserClientService {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = (
      config.get<string>("USER_SERVICE_URL") ??
      config.get<string>("USER_SERVICE") ??
      "http://localhost:5000"
    ).replace(/\/+$/, "");
  }

  async exists(userId: string, requestId: string): Promise<boolean> {
    const response = await fetch(
      `${this.baseUrl}/api/user/internal/${encodeURIComponent(userId)}`,
      { headers: { "x-request-id": requestId } },
    );
    return response.ok;
  }

  async enrichTasks(
    tasks: TaskRow[],
    userPayload: string | undefined,
    requestId: string,
  ): Promise<TaskRow[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/user/user/all`, {
        headers: {
          "x-user-payload": userPayload ?? "",
          "x-request-id": requestId,
        },
      });
      if (!response.ok) return tasks;
      const payload = (await response.json()) as { users?: unknown };
      if (!Array.isArray(payload.users)) return tasks;
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
    } catch (error) {
      console.error("Lỗi khi fetch users để populate:", error);
      return tasks;
    }
  }
}
