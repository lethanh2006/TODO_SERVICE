import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Authenticated } from "../../common/decorators/authenticated.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { MANAGEMENT_ROLES } from "../../common/enums/role.enum";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { RequestWithContext } from "../../common/interfaces/request-context.interface";
import { AssignTaskDto } from "./dto/assign-task.dto";
import { CreateTaskDto } from "./dto/create-task.dto";
import { MyTaskQueryDto, TaskQueryDto } from "./dto/task-query.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { UpdateTaskStatusDto } from "./dto/update-task-status.dto";
import { TaskService } from "./task.service";

@Controller("api/todo")
@UseGuards(RolesGuard)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get("my-tasks")
  @Authenticated()
  getMyTasks(
    @Query() query: MyTaskQueryDto,
    @Req() request: RequestWithContext,
  ) {
    return this.taskService.findMine(
      request.user!,
      query,
      this.userPayload(request),
      this.requestId(request),
    );
  }

  @Patch(":id/status")
  @Authenticated()
  updateStatus(
    @Param("id") id: string,
    @Body() body: UpdateTaskStatusDto,
    @Req() request: RequestWithContext,
  ) {
    return this.taskService.updateStatus(id, body.status, request.user!);
  }

  @Post()
  @Roles(...MANAGEMENT_ROLES)
  create(@Body() body: CreateTaskDto, @Req() request: RequestWithContext) {
    return this.taskService.create(
      body,
      request.user!,
      this.requestId(request),
    );
  }

  @Patch(":id/assign")
  @Roles(...MANAGEMENT_ROLES)
  assign(
    @Param("id") id: string,
    @Body() body: AssignTaskDto,
    @Req() request: RequestWithContext,
  ) {
    return this.taskService.assign(id, body, this.requestId(request));
  }

  @Patch(":id")
  @Roles(...MANAGEMENT_ROLES)
  update(
    @Param("id") id: string,
    @Body() body: UpdateTaskDto,
    @Req() request: RequestWithContext,
  ) {
    return this.taskService.update(id, body, request.user!);
  }

  @Get()
  @Roles(...MANAGEMENT_ROLES)
  getAll(@Query() query: TaskQueryDto, @Req() request: RequestWithContext) {
    return this.taskService.findAll(
      query,
      this.userPayload(request),
      this.requestId(request),
    );
  }

  @Get(":id")
  @Authenticated()
  getOne(@Param("id") id: string, @Req() request: RequestWithContext) {
    return this.taskService.findOne(
      id,
      request.user!,
      this.userPayload(request),
      this.requestId(request),
    );
  }

  @Delete(":id")
  @Roles(...MANAGEMENT_ROLES)
  remove(@Param("id") id: string) {
    return this.taskService.remove(id);
  }

  private requestId(request: RequestWithContext): string {
    return request.requestContext?.requestId ?? "";
  }

  private userPayload(request: RequestWithContext): string | undefined {
    const value = request.headers["x-user-payload"];
    return typeof value === "string" ? value : undefined;
  }
}
