import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Types, type Model, type QueryFilter } from 'mongoose';
import { authenticatedUserId } from '../../common/utils/authenticated-user.util';
import { type AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { isManagementRole } from '../../common/utils/role.util';
import { toError } from '../../common/utils/error.util';
import {
  PRIORITY_ORDER,
  Task,
  type TaskDocument,
  type TaskPriority,
  type TaskStatus,
} from '../../schemas/task.schema';
import { UserClientService } from '../user-client/user-client.service';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { MyTaskQueryDto, TaskQueryDto } from './dto/task-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const ASSIGNEE_TRANSITIONS: Readonly<
  Record<TaskStatus, readonly TaskStatus[]>
> = {
  todo: ['in_progress'],
  in_progress: ['done'],
  done: [],
  cancelled: [],
};

const MANAGEMENT_TRANSITIONS: Readonly<
  Record<TaskStatus, readonly TaskStatus[]>
> = {
  todo: ['in_progress', 'cancelled'],
  in_progress: ['todo', 'done', 'cancelled'],
  done: ['in_progress'],
  cancelled: ['todo'],
};

type TaskPageResult = {
  tasks: Record<string, unknown>[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const MY_TASK_CACHE_TTL_MS = 5_000;

@Injectable()
export class TaskService {
  private readonly pendingMineReads = new Map<
    string,
    Promise<TaskPageResult>
  >();
  private readonly completedMineReads = new Map<
    string,
    { expiresAt: number; value: TaskPageResult }
  >();
  private mineReadGeneration = 0;

  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    private readonly userClient: UserClientService,
  ) {}

  async create(dto: CreateTaskDto, user: AuthenticatedUser, requestId: string) {
    try {
      const title = dto.title.trim();
      if (!title) {
        throw new BadRequestException({
          message: 'Tiêu đề không được để trống',
        });
      }
      if (
        dto.assignedTo &&
        !(await this.userClient.exists(dto.assignedTo, requestId))
      ) {
        throw new BadRequestException({
          message: 'Người dùng được giao không tồn tại',
        });
      }
      if (dto.deadline) {
        const d = new Date(dto.deadline);
        if (isNaN(d.getTime())) {
          throw new BadRequestException({ message: 'Hạn chót không hợp lệ' });
        }
      }
      const priority = dto.priority ?? 'medium';
      const priorityOrder = PRIORITY_ORDER[priority] ?? 2;
      const task = await this.taskModel.create({
        ...dto,
        title,
        priority,
        priorityOrder,
        createdBy: authenticatedUserId(user),
      });
      this.invalidateMineReads();
      return {
        message: 'Tạo công việc thành công',
        task: this.toPlainTask(task),
      };
    } catch (error) {
      this.rethrowOrFail(error, 'Lỗi khi tạo công việc');
    }
  }

  async assign(id: string, dto: AssignTaskDto, requestId: string) {
    try {
      this.assertValidId(id);
      const task = await this.taskModel.findById(id);
      if (!task) {
        throw new NotFoundException({ message: 'Không tìm thấy công việc' });
      }
      if (task.status === 'done' || task.status === 'cancelled') {
        throw new ConflictException({
          message:
            'Không thể giao lại công việc đã hoàn thành hoặc đã huỷ; hãy mở lại công việc trước',
        });
      }
      try {
        if (!(await this.userClient.exists(dto.assignedTo, requestId))) {
          throw new BadRequestException({
            message: 'Người dùng được giao không tồn tại',
          });
        }
      } catch (error) {
        if (error instanceof HttpException) throw error;
        throw new ServiceUnavailableException({
          message: 'Không kết nối được dịch vụ người dùng',
        });
      }
      const updatedTask = await this.taskModel.findOneAndUpdate(
        {
          _id: id,
          status: task.status,
          assignedTo: task.assignedTo ?? null,
        },
        { $set: { assignedTo: dto.assignedTo } },
        { new: true, runValidators: true },
      );
      if (!updatedTask) {
        throw new ConflictException({
          message:
            'Công việc đã thay đổi trạng thái hoặc người được giao; vui lòng tải lại',
        });
      }
      this.invalidateMineReads();
      return { message: 'Giao lại công việc thành công', task: updatedTask };
    } catch (error) {
      this.rethrowOrFail(error, 'Lỗi khi giao lại công việc');
    }
  }

  async findAll(
    query: TaskQueryDto,
    userPayload: string | undefined,
    requestId: string,
  ) {
    try {
      return await this.findPage(query, {}, userPayload, requestId);
    } catch (error) {
      this.fail(error, 'Lỗi khi lấy danh sách công việc');
    }
  }

  async findMine(
    user: AuthenticatedUser,
    query: MyTaskQueryDto,
    userPayload: string | undefined,
    requestId: string,
  ) {
    try {
      const userId = authenticatedUserId(user);
      const generation = this.mineReadGeneration;
      const key = JSON.stringify([
        generation,
        userId,
        user.role?.toLowerCase() ?? '',
        query.page ?? 1,
        query.limit ?? 20,
        query.status ?? null,
        query.priority ?? null,
        query.search?.trim() || null,
        query.sortBy ?? null,
        query.order ?? null,
        query.deadlineFrom ?? null,
        query.deadlineTo ?? null,
      ]);
      return await this.findMinePage(
        key,
        generation,
        query,
        { assignedTo: userId },
        userPayload,
        requestId,
      );
    } catch (error) {
      this.fail(error, 'Lỗi khi lấy danh sách công việc');
    }
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
    userPayload: string | undefined,
    requestId: string,
  ) {
    try {
      this.assertValidId(id);
      const task = (await this.taskModel
        .findById(id)
        .lean()) as unknown as Record<string, unknown> | null;
      if (!task) {
        throw new NotFoundException({ message: 'Không tìm thấy công việc' });
      }
      this.assertCanAccess(task, user);
      const [enriched] = await this.userClient.enrichTasks(
        [task],
        userPayload,
        requestId,
      );
      return { task: this.toPlainTask(enriched) };
    } catch (error) {
      this.rethrowOrFail(error, 'Lỗi khi lấy chi tiết công việc');
    }
  }

  async update(id: string, dto: UpdateTaskDto, user: AuthenticatedUser) {
    try {
      this.assertValidId(id);
      if (!isManagementRole(user.role)) {
        throw new ForbiddenException({
          message: 'Chỉ nhóm quản trị được cập nhật nội dung công việc',
        });
      }

      const set: Record<string, unknown> = {};
      const unset: Record<string, 1> = {};
      if (dto.title !== undefined) {
        const title = dto.title.trim();
        if (!title) {
          throw new BadRequestException({
            message: 'Tiêu đề không được để trống',
          });
        }
        set.title = title;
      }
      if (dto.description !== undefined) {
        if (dto.description === null) unset.description = 1;
        else set.description = dto.description;
      }
      if (dto.priority !== undefined) {
        set.priority = dto.priority;
        set.priorityOrder = PRIORITY_ORDER[dto.priority] ?? 2;
      }
      if (dto.deadline !== undefined) {
        if (dto.deadline === null) unset.deadline = 1;
        else {
          const d = new Date(dto.deadline);
          if (isNaN(d.getTime())) {
            throw new BadRequestException({ message: 'Hạn chót không hợp lệ' });
          }
          set.deadline = d;
        }
      }

      if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) {
        throw new BadRequestException({
          message: 'Cần cung cấp ít nhất một trường để cập nhật',
        });
      }

      const update: Record<string, unknown> = {};
      if (Object.keys(set).length > 0) update.$set = set;
      if (Object.keys(unset).length > 0) update.$unset = unset;
      const task = await this.taskModel.findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
      });
      if (!task) {
        throw new NotFoundException({ message: 'Không tìm thấy công việc' });
      }
      this.invalidateMineReads();
      return {
        message: 'Cập nhật công việc thành công',
        task: this.toPlainTask(task),
      };
    } catch (error) {
      this.rethrowOrFail(error, 'Lỗi khi cập nhật công việc');
    }
  }

  async updatePriority(
    id: string,
    priority: TaskPriority,
    user: AuthenticatedUser,
  ) {
    try {
      this.assertValidId(id);
      if (!isManagementRole(user.role)) {
        throw new ForbiddenException({
          message: 'Chỉ nhóm quản trị được thay đổi mức độ ưu tiên công việc',
        });
      }
      const task = await this.taskModel.findById(id);
      if (!task) {
        throw new NotFoundException({ message: 'Không tìm thấy công việc' });
      }
      if (task.status === 'done' || task.status === 'cancelled') {
        throw new ConflictException({
          message:
            'Không thể thay đổi mức độ ưu tiên của công việc đã hoàn thành hoặc đã huỷ',
        });
      }
      const priorityOrder = PRIORITY_ORDER[priority] ?? 2;
      const updatedTask = await this.taskModel.findByIdAndUpdate(
        id,
        { $set: { priority, priorityOrder } },
        { new: true, runValidators: true },
      );
      if (!updatedTask) {
        throw new NotFoundException({ message: 'Không tìm thấy công việc' });
      }
      this.invalidateMineReads();
      return {
        message: 'Cập nhật mức độ ưu tiên thành công',
        task: this.toPlainTask(updatedTask),
      };
    } catch (error) {
      this.rethrowOrFail(error, 'Lỗi khi cập nhật mức độ ưu tiên');
    }
  }

  async remove(id: string) {
    try {
      this.assertValidId(id);
      const task = await this.taskModel.findByIdAndDelete(id);
      if (!task) {
        throw new NotFoundException({ message: 'Không tìm thấy công việc' });
      }
      this.invalidateMineReads();
      return { message: 'Xoá công việc thành công' };
    } catch (error) {
      this.rethrowOrFail(error, 'Lỗi khi xoá công việc');
    }
  }

  async updateStatus(id: string, status: TaskStatus, user: AuthenticatedUser) {
    try {
      this.assertValidId(id);
      const task = await this.taskModel.findById(id);
      if (!task) {
        throw new NotFoundException({ message: 'Không tìm thấy công việc' });
      }
      const currentUserId = authenticatedUserId(user);
      const assigned = this.matchesId(task.assignedTo, currentUserId);
      const canManage = isManagementRole(user.role);
      if (!assigned && !canManage) {
        throw new ForbiddenException({
          message: 'Từ chối truy cập: Không được giao công việc này',
        });
      }
      if (task.status === status) {
        return { message: 'Trạng thái công việc không thay đổi', task };
      }

      const allowedTransitions = canManage
        ? MANAGEMENT_TRANSITIONS[task.status]
        : ASSIGNEE_TRANSITIONS[task.status];
      if (!allowedTransitions.includes(status)) {
        throw new ConflictException({
          message: `Không thể chuyển trạng thái công việc từ ${task.status} sang ${status}`,
        });
      }

      const filter: QueryFilter<TaskDocument> = {
        _id: id,
        status: task.status,
      };
      if (!canManage) filter.assignedTo = currentUserId;
      const setFields: Record<string, unknown> = { status };
      if (status === 'done') {
        setFields.progress = 100;
      }
      const updatedTask = await this.taskModel.findOneAndUpdate(
        filter,
        { $set: setFields },
        { new: true, runValidators: true },
      );
      if (!updatedTask) {
        throw new ConflictException({
          message:
            'Công việc đã thay đổi trạng thái hoặc người được giao; vui lòng tải lại',
        });
      }
      this.invalidateMineReads();
      return {
        message: 'Cập nhật trạng thái công việc thành công',
        task: this.toPlainTask(updatedTask),
      };
    } catch (error) {
      this.rethrowOrFail(error, 'Lỗi khi cập nhật trạng thái công việc');
    }
  }

  async updateDeadline(
    id: string,
    deadlineStr: string,
    user: AuthenticatedUser,
  ) {
    try {
      this.assertValidId(id);
      if (!isManagementRole(user.role)) {
        throw new ForbiddenException({
          message: 'Chỉ nhóm quản trị được thay đổi hạn chót công việc',
        });
      }
      const task = await this.taskModel.findById(id);
      if (!task) {
        throw new NotFoundException({ message: 'Không tìm thấy công việc' });
      }
      if (task.status === 'done' || task.status === 'cancelled') {
        throw new ConflictException({
          message:
            'Không thể thay đổi hạn chót của công việc đã hoàn thành hoặc đã huỷ',
        });
      }
      const deadline = new Date(deadlineStr);
      if (isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) {
        throw new BadRequestException({
          message: 'Hạn chót phải lớn hơn thời điểm hiện tại',
        });
      }
      const updatedTask = await this.taskModel.findByIdAndUpdate(
        id,
        { $set: { deadline } },
        { new: true, runValidators: true },
      );
      if (!updatedTask) {
        throw new NotFoundException({ message: 'Không tìm thấy công việc' });
      }
      this.invalidateMineReads();
      return {
        message: 'Cập nhật hạn chót thành công',
        task: this.toPlainTask(updatedTask),
      };
    } catch (error) {
      this.rethrowOrFail(error, 'Lỗi khi cập nhật hạn chót');
    }
  }

  async updateProgress(id: string, progress: number, user: AuthenticatedUser) {
    try {
      this.assertValidId(id);
      const task = await this.taskModel.findById(id);
      if (!task) {
        throw new NotFoundException({ message: 'Không tìm thấy công việc' });
      }
      const currentUserId = authenticatedUserId(user);
      const assigned = this.matchesId(task.assignedTo, currentUserId);
      const canManage = isManagementRole(user.role);
      if (!assigned && !canManage) {
        throw new ForbiddenException({
          message: 'Từ chối truy cập: Không được giao công việc này',
        });
      }
      if (task.status !== 'in_progress') {
        throw new ConflictException({
          message:
            'Chỉ có thể cập nhật tiến độ khi công việc đang được thực hiện (in_progress)',
        });
      }
      const updatedTask = await this.taskModel.findByIdAndUpdate(
        id,
        { $set: { progress } },
        { new: true, runValidators: true },
      );
      if (!updatedTask) {
        throw new NotFoundException({ message: 'Không tìm thấy công việc' });
      }
      this.invalidateMineReads();
      return {
        message: 'Cập nhật tiến độ thành công',
        task: this.toPlainTask(updatedTask),
      };
    } catch (error) {
      this.rethrowOrFail(error, 'Lỗi khi cập nhật tiến độ');
    }
  }

  async getOverdue(
    user: AuthenticatedUser,
    userPayload: string | undefined,
    requestId: string,
  ) {
    try {
      const now = new Date();
      const filter: QueryFilter<TaskDocument> = {
        deadline: { $lt: now },
        status: { $nin: ['done', 'cancelled'] },
      };
      if (!isManagementRole(user.role)) {
        filter.assignedTo = authenticatedUserId(user);
      }
      const tasks = (await this.taskModel
        .find(filter)
        .sort({ deadline: 1, _id: -1 })
        .lean()) as unknown as Record<string, unknown>[];
      const enriched = await this.userClient.enrichTasks(
        tasks,
        userPayload,
        requestId,
      );
      return {
        tasks: enriched.map((t) => this.toPlainTask(t)),
        total: tasks.length,
      };
    } catch (error) {
      this.fail(error, 'Lỗi khi lấy danh sách công việc quá hạn');
    }
  }

  async getUpcomingDeadline(
    days: number,
    user: AuthenticatedUser,
    userPayload: string | undefined,
    requestId: string,
  ) {
    try {
      const now = new Date();
      const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const filter: QueryFilter<TaskDocument> = {
        deadline: { $gte: now, $lte: future },
        status: { $nin: ['done', 'cancelled'] },
      };
      if (!isManagementRole(user.role)) {
        filter.assignedTo = authenticatedUserId(user);
      }
      const tasks = (await this.taskModel
        .find(filter)
        .sort({ deadline: 1, _id: -1 })
        .lean()) as unknown as Record<string, unknown>[];
      const enriched = await this.userClient.enrichTasks(
        tasks,
        userPayload,
        requestId,
      );
      return {
        tasks: enriched.map((t) => this.toPlainTask(t)),
        total: tasks.length,
      };
    } catch (error) {
      this.fail(error, 'Lỗi khi lấy danh sách công việc sắp đến hạn');
    }
  }

  private async findPage(
    query: MyTaskQueryDto | TaskQueryDto,
    baseFilter: QueryFilter<TaskDocument>,
    userPayload: string | undefined,
    requestId: string,
    enrichUsers = true,
  ): Promise<TaskPageResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter = this.buildFilter(query, baseFilter);
    const sort = this.buildSort(query);
    let tasks: Record<string, unknown>[];
    if (query.sortBy === 'priority') {
      // Production tasks created before this release have no priorityOrder.
      // Derive the rank from priority so old and new tasks sort together.
      const match = { ...filter };
      for (const key of ['assignedTo', 'createdBy'] as const) {
        if (typeof match[key] === 'string') {
          match[key] = new Types.ObjectId(match[key]);
        }
      }
      tasks = await this.taskModel.aggregate<Record<string, unknown>>([
        { $match: match },
        {
          $addFields: {
            priorityOrder: {
              $switch: {
                branches: Object.entries(PRIORITY_ORDER).map(
                  ([priority, rank]) => ({
                    case: { $eq: ['$priority', priority] },
                    then: rank,
                  }),
                ),
                default: PRIORITY_ORDER.medium,
              },
            },
          },
        },
        { $sort: sort },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ]);
    } else {
      tasks = (await this.taskModel
        .find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()) as unknown as Record<string, unknown>[];
    }
    // On the first page, fewer rows than the page limit proves there are no
    // later matches. Avoid a second Atlas round trip for this common case.
    const total =
      page === 1 && tasks.length < limit
        ? tasks.length
        : await this.taskModel.countDocuments(filter);
    const enrichedTasks = enrichUsers
      ? await this.userClient.enrichTasks(tasks, userPayload, requestId)
      : tasks;
    return {
      // The employee web only needs task fields on /my-tasks. Skipping the
      // User Service round trip keeps this critical list available even when
      // that downstream service is slow. Management lists still opt in to
      // assignee/creator enrichment through the default value above.
      tasks: enrichedTasks.map((t) => this.toPlainTask(t)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async findMinePage(
    key: string,
    generation: number,
    query: MyTaskQueryDto,
    baseFilter: QueryFilter<TaskDocument>,
    userPayload: string | undefined,
    requestId: string,
  ): Promise<TaskPageResult> {
    const cached = this.completedMineReads.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    if (cached) this.completedMineReads.delete(key);

    const pending = this.pendingMineReads.get(key);
    if (pending) return pending;
    if (this.pendingMineReads.size >= 128) {
      return this.findPage(query, baseFilter, userPayload, requestId, false);
    }

    const read = this.findPage(
      query,
      baseFilter,
      userPayload,
      requestId,
      false,
    );
    this.pendingMineReads.set(key, read);
    try {
      const value = await read;
      if (generation === this.mineReadGeneration) {
        this.rememberMineRead(key, value);
      }
      return value;
    } finally {
      if (this.pendingMineReads.get(key) === read) {
        this.pendingMineReads.delete(key);
      }
    }
  }

  private rememberMineRead(key: string, value: TaskPageResult): void {
    if (this.completedMineReads.size >= 256) {
      const oldestKey: string | undefined = Array.from(
        this.completedMineReads.keys(),
      )[0];
      if (oldestKey !== undefined) this.completedMineReads.delete(oldestKey);
    }
    this.completedMineReads.set(key, {
      expiresAt: Date.now() + MY_TASK_CACHE_TTL_MS,
      value,
    });
  }

  private invalidateMineReads(): void {
    // Writes in this single service replica invalidate the cached task views.
    this.mineReadGeneration += 1;
    this.completedMineReads.clear();
  }

  private buildFilter(
    query: MyTaskQueryDto | TaskQueryDto,
    baseFilter: QueryFilter<TaskDocument>,
  ): QueryFilter<TaskDocument> {
    const filter: QueryFilter<TaskDocument> = { ...baseFilter };
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (
      'assignedTo' in query &&
      query.assignedTo &&
      baseFilter.assignedTo === undefined
    ) {
      filter.assignedTo = query.assignedTo;
    }
    if ('createdBy' in query && query.createdBy) {
      filter.createdBy = query.createdBy;
    }
    if (query.deadlineFrom || query.deadlineTo) {
      const deadlineFilter: Record<string, Date> = {};
      if (query.deadlineFrom)
        deadlineFilter.$gte = new Date(query.deadlineFrom);
      if (query.deadlineTo) deadlineFilter.$lte = new Date(query.deadlineTo);
      filter.deadline = deadlineFilter;
    }
    if (query.search) {
      const pattern = new RegExp(this.escapeRegex(query.search), 'i');
      filter.$or = [{ title: pattern }, { description: pattern }];
    }
    return filter;
  }

  private buildSort(
    query: MyTaskQueryDto | TaskQueryDto,
  ): Record<string, 1 | -1> {
    const sort: Record<string, 1 | -1> = {};
    const dir: 1 | -1 = query.order === 'asc' ? 1 : -1;
    if (query.sortBy === 'priority') {
      sort.priorityOrder = dir;
    } else if (query.sortBy === 'deadline') {
      sort.deadline = dir;
    } else if (query.sortBy === 'title') {
      sort.title = dir;
    } else if (query.sortBy === 'updatedAt') {
      sort.updatedAt = dir;
    } else if (query.sortBy === 'createdAt') {
      sort.createdAt = dir;
    } else {
      sort.createdAt = -1;
    }
    sort._id = -1;
    return sort;
  }

  private toPlainTask<T>(task: T): T {
    if (!task || typeof task !== 'object') return task;
    const plain: Record<string, unknown> =
      typeof (task as { toObject?: unknown }).toObject === 'function'
        ? (
            task as unknown as { toObject: () => Record<string, unknown> }
          ).toObject()
        : { ...(task as Record<string, unknown>) };
    if (plain.deadline != null) {
      const deadlineDate = new Date(plain.deadline as string | Date);
      const isOverdue =
        !isNaN(deadlineDate.getTime()) &&
        deadlineDate.getTime() < Date.now() &&
        plain.status !== 'done' &&
        plain.status !== 'cancelled';
      plain.overdue = isOverdue;
      plain.isOverdue = isOverdue;
    }
    return plain as T;
  }

  private assertCanAccess(
    task: { assignedTo?: unknown },
    user: AuthenticatedUser,
  ): void {
    const assigned = this.matchesId(task.assignedTo, authenticatedUserId(user));
    if (!assigned && !isManagementRole(user.role)) {
      throw new ForbiddenException({
        message: 'Từ chối truy cập: Không được giao công việc này',
      });
    }
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private matchesId(value: unknown, expected: string): boolean {
    if (typeof value === 'string') return value === expected;
    if (!value || typeof value !== 'object') return false;
    const toHexString = (value as { toHexString?: unknown }).toHexString;
    if (typeof toHexString !== 'function') return false;
    return (toHexString as () => string).call(value) === expected;
  }

  private assertValidId(id: string): void {
    if (!isValidObjectId(id)) {
      throw new BadRequestException({ message: 'ID công việc không hợp lệ' });
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
