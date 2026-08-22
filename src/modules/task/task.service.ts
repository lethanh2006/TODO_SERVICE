import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { isValidObjectId, type Model } from "mongoose";
import {
  authenticatedUserId,
  type AuthenticatedUser,
} from "../../common/interfaces/authenticated-user.interface";
import { toError } from "../../common/utils/error.util";
import {
  Task,
  type TaskDocument,
  type TaskStatus,
} from "../../schemas/task.schema";
import { UserClientService } from "../user-client/user-client.service";
import { AssignTaskDto } from "./dto/assign-task.dto";
import { CreateTaskDto } from "./dto/create-task.dto";

@Injectable()
export class TaskService {
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    private readonly userClient: UserClientService,
  ) {}

  async create(dto: CreateTaskDto, user: AuthenticatedUser, requestId: string) {
    try {
      const title = dto.title.trim();
      if (!title) {
        throw new BadRequestException({
          message: "Tiêu đề không được để trống",
        });
      }
      if (
        dto.assignedTo &&
        !(await this.userClient.exists(dto.assignedTo, requestId))
      ) {
        throw new BadRequestException({
          message: "Người dùng được giao không tồn tại",
        });
      }
      const task = await this.taskModel.create({
        ...dto,
        title,
        createdBy: authenticatedUserId(user),
      });
      return { message: "Tạo công việc thành công", task };
    } catch (error) {
      this.rethrowOrFail(error, "Lỗi khi tạo công việc");
    }
  }

  async assign(id: string, dto: AssignTaskDto, requestId: string) {
    try {
      this.assertValidId(id);
      const task = await this.taskModel.findById(id);
      if (!task) {
        throw new NotFoundException({ message: "Không tìm thấy công việc" });
      }
      try {
        if (!(await this.userClient.exists(dto.assignedTo, requestId))) {
          throw new BadRequestException({
            message: "Người dùng được giao không tồn tại",
          });
        }
      } catch (error) {
        if (error instanceof HttpException) throw error;
        throw new ServiceUnavailableException({
          message: "Không kết nối được dịch vụ người dùng",
        });
      }
      task.assignedTo = dto.assignedTo as any;
      await task.save();
      return { message: "Giao lại công việc thành công", task };
    } catch (error) {
      this.rethrowOrFail(error, "Lỗi khi giao lại công việc");
    }
  }

  async findAll(userPayload: string | undefined, requestId: string) {
    try {
      const tasks = (await this.taskModel
        .find()
        .sort({ createdAt: -1 })
        .lean()) as unknown as Record<string, any>[];
      return {
        tasks: await this.userClient.enrichTasks(tasks, userPayload, requestId),
      };
    } catch (error) {
      this.fail(error, "Lỗi khi lấy danh sách công việc");
    }
  }

  async findMine(
    user: AuthenticatedUser,
    userPayload: string | undefined,
    requestId: string,
  ) {
    try {
      const tasks = (await this.taskModel
        .find({ assignedTo: authenticatedUserId(user) })
        .sort({ createdAt: -1 })
        .lean()) as unknown as Record<string, any>[];
      return {
        tasks: await this.userClient.enrichTasks(tasks, userPayload, requestId),
      };
    } catch (error) {
      this.fail(error, "Lỗi khi lấy danh sách công việc ");
    }
  }

  async remove(id: string) {
    try {
      this.assertValidId(id);
      const task = await this.taskModel.findByIdAndDelete(id);
      if (!task) {
        throw new NotFoundException({ message: "Không tìm thấy công việc" });
      }
      return { message: "Xoá công việc thành công" };
    } catch (error) {
      this.rethrowOrFail(error, "Lỗi khi xoá công việc");
    }
  }

  async updateStatus(id: string, status: TaskStatus, user: AuthenticatedUser) {
    try {
      this.assertValidId(id);
      const task = await this.taskModel.findById(id);
      if (!task) {
        throw new NotFoundException({ message: "Không tìm thấy công việc" });
      }
      const currentUserId = authenticatedUserId(user);
      const assigned = String(task.assignedTo) === currentUserId;
      const admin = user.role?.toLowerCase() === "admin";
      if (!assigned && !admin) {
        throw new ForbiddenException({
          message: "Từ chối truy cập: Không được giao công việc này",
        });
      }
      task.status = status;
      await task.save();
      return { message: "Cập nhật trạng thái công việc thành công", task };
    } catch (error) {
      this.rethrowOrFail(error, "Lỗi khi cập nhật trạng thái công việc");
    }
  }

  private assertValidId(id: string): void {
    if (!isValidObjectId(id)) {
      throw new BadRequestException({ message: "ID công việc không hợp lệ" });
    }
  }

  private rethrowOrFail(error: unknown, message: string): never {
    if (error instanceof HttpException) throw error;
    this.fail(error, message);
  }

  private fail(error: unknown, message: string): never {
    throw new HttpException(
      { message, error: toError(error).message },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
