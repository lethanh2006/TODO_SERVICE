import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Model } from 'mongoose';
import type { TaskDocument } from '../../schemas/task.schema';
import type { UserClientService } from '../user-client/user-client.service';
import { MyTaskQueryDto, type TaskQueryDto } from './dto/task-query.dto';
import type { UpdateTaskDto } from './dto/update-task.dto';
import { TaskService } from './task.service';

const TASK_ID = '507f1f77bcf86cd799439011';
const USER_ID = '507f1f77bcf86cd799439012';
const OTHER_USER_ID = '507f1f77bcf86cd799439013';
const MANAGER_ID = '507f1f77bcf86cd799439014';

function createHarness() {
  const taskModel = {
    countDocuments: jest.fn(),
    create: jest.fn(),
    find: jest.fn<unknown, [Record<string, unknown>]>(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };
  const userClient = {
    enrichTasks: jest.fn(),
    exists: jest.fn(),
  };
  const service = new TaskService(
    taskModel as unknown as Model<TaskDocument>,
    userClient as unknown as UserClientService,
  );

  return { service, taskModel, userClient };
}

describe('TaskService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lọc, phân trang và escape ký tự regex cho danh sách quản trị', async () => {
    const { service, taskModel, userClient } = createHarness();
    const lean = jest.fn().mockResolvedValue([{ _id: TASK_ID }]);
    const limit = jest.fn().mockReturnValue({ lean });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    taskModel.find.mockReturnValue({ sort });
    taskModel.countDocuments.mockResolvedValue(21);
    userClient.enrichTasks.mockResolvedValue([
      { _id: TASK_ID, assignedTo: { _id: USER_ID, username: 'an' } },
    ]);
    const query = {
      status: 'todo',
      priority: 'high',
      assignedTo: USER_ID,
      createdBy: MANAGER_ID,
      search: 'A+B',
      page: 2,
      limit: 10,
    } as TaskQueryDto;

    const result = await service.findAll(query, 'payload', 'request-1');

    const filter = taskModel.find.mock.calls[0]?.[0];
    expect(filter).toEqual(
      expect.objectContaining({
        status: 'todo',
        priority: 'high',
        assignedTo: USER_ID,
        createdBy: MANAGER_ID,
      }),
    );
    const searchFilters = filter.$or as Array<Record<string, RegExp>>;
    expect(searchFilters[0]?.title.source).toBe('A\\+B');
    expect(searchFilters[1]?.description.source).toBe('A\\+B');
    expect(sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(skip).toHaveBeenCalledWith(10);
    expect(limit).toHaveBeenCalledWith(10);
    expect(taskModel.countDocuments).toHaveBeenCalledWith(filter);
    expect(userClient.enrichTasks).toHaveBeenCalledWith(
      [{ _id: TASK_ID }],
      'payload',
      'request-1',
    );
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 21,
      totalPages: 3,
    });
  });

  it('luôn khóa danh sách cá nhân theo người đang đăng nhập', async () => {
    const { service, taskModel, userClient } = createHarness();
    const lean = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ lean });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    taskModel.find.mockReturnValue({ sort });
    taskModel.countDocuments.mockResolvedValue(0);
    userClient.enrichTasks.mockResolvedValue([]);
    const tamperedQuery = {
      assignedTo: OTHER_USER_ID,
      page: 1,
      limit: 20,
    } as unknown as MyTaskQueryDto;

    await service.findMine(
      { _id: USER_ID, role: 'user' },
      tamperedQuery,
      'payload',
      'request-2',
    );

    expect(taskModel.find).toHaveBeenCalledWith({ assignedTo: USER_ID });
  });

  it('DTO danh sách cá nhân loại bỏ bộ lọc chỉ dành cho quản trị', async () => {
    const query = plainToInstance(MyTaskQueryDto, {
      assignedTo: OTHER_USER_ID,
      createdBy: MANAGER_ID,
      page: '2',
      search: '  bàn 3  ',
    });

    await expect(validate(query, { whitelist: true })).resolves.toEqual([]);

    expect(query.page).toBe(2);
    expect(query.search).toBe('bàn 3');
    expect('assignedTo' in query).toBe(false);
    expect('createdBy' in query).toBe(false);
  });

  it('chỉ người được giao hoặc khối quản trị được xem chi tiết', async () => {
    const { service, taskModel, userClient } = createHarness();
    taskModel.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: TASK_ID,
        assignedTo: OTHER_USER_ID,
      }),
    });

    await expect(
      service.findOne(
        TASK_ID,
        { _id: USER_ID, role: 'waiter' },
        'payload',
        'request-3',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(userClient.enrichTasks).not.toHaveBeenCalled();
  });

  it('từ chối ID sai định dạng trước khi truy vấn chi tiết', async () => {
    const { service, taskModel } = createHarness();

    await expect(
      service.findOne(
        'khong-phai-object-id',
        { _id: USER_ID, role: 'user' },
        'payload',
        'request-invalid-id',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(taskModel.findById).not.toHaveBeenCalled();
  });

  it('trả 404 khi không còn công việc cần xem', async () => {
    const { service, taskModel } = createHarness();
    taskModel.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.findOne(
        TASK_ID,
        { _id: USER_ID, role: 'user' },
        'payload',
        'request-missing',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('trả chi tiết đã enrich cho khối quản trị', async () => {
    const { service, taskModel, userClient } = createHarness();
    const task = { _id: TASK_ID, assignedTo: OTHER_USER_ID };
    const enrichedTask = {
      ...task,
      assignedTo: { _id: OTHER_USER_ID, username: 'binh' },
    };
    taskModel.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(task),
    });
    userClient.enrichTasks.mockResolvedValue([enrichedTask]);

    await expect(
      service.findOne(
        TASK_ID,
        { _id: MANAGER_ID, role: 'manager' },
        'payload',
        'request-4',
      ),
    ).resolves.toEqual({ task: enrichedTask });
  });

  it('cập nhật nội dung bằng set/unset và chuẩn hóa tiêu đề', async () => {
    const { service, taskModel } = createHarness();
    const updated = { _id: TASK_ID, title: 'Báo cáo tuần' };
    taskModel.findByIdAndUpdate.mockResolvedValue(updated);
    const dto: UpdateTaskDto = {
      title: '  Báo cáo tuần  ',
      description: null,
      deadline: null,
    };

    await expect(
      service.update(TASK_ID, dto, {
        _id: MANAGER_ID,
        role: 'manager',
      }),
    ).resolves.toEqual({
      message: 'Cập nhật công việc thành công',
      task: updated,
    });
    expect(taskModel.findByIdAndUpdate).toHaveBeenCalledWith(
      TASK_ID,
      {
        $set: { title: 'Báo cáo tuần' },
        $unset: { description: 1, deadline: 1 },
      },
      { new: true, runValidators: true },
    );
  });

  it('không cho người dùng thường sửa nội dung công việc', async () => {
    const { service, taskModel } = createHarness();

    await expect(
      service.update(
        TASK_ID,
        { title: 'Không hợp lệ' },
        { _id: USER_ID, role: 'user' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(taskModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('từ chối PATCH nội dung rỗng', async () => {
    const { service, taskModel } = createHarness();

    await expect(
      service.update(TASK_ID, {}, { _id: MANAGER_ID, role: 'manager' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(taskModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('không cho người được giao bỏ qua chuỗi trạng thái', async () => {
    const { service, taskModel } = createHarness();
    taskModel.findById.mockResolvedValue({
      _id: TASK_ID,
      assignedTo: USER_ID,
      status: 'todo',
    });

    await expect(
      service.updateStatus(TASK_ID, 'done', {
        _id: USER_ID,
        role: 'user',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(taskModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('cập nhật trạng thái người được giao bằng điều kiện chống ghi đè', async () => {
    const { service, taskModel } = createHarness();
    taskModel.findById.mockResolvedValue({
      _id: TASK_ID,
      assignedTo: USER_ID,
      status: 'todo',
    });
    const updated = {
      _id: TASK_ID,
      assignedTo: USER_ID,
      status: 'in_progress',
    };
    taskModel.findOneAndUpdate.mockResolvedValue(updated);

    await expect(
      service.updateStatus(TASK_ID, 'in_progress', {
        _id: USER_ID,
        role: 'waiter',
      }),
    ).resolves.toEqual({
      message: 'Cập nhật trạng thái công việc thành công',
      task: updated,
    });
    expect(taskModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: TASK_ID, status: 'todo', assignedTo: USER_ID },
      { $set: { status: 'in_progress' } },
      { new: true, runValidators: true },
    );
  });

  it('cho khối quản trị mở lại công việc đã huỷ', async () => {
    const { service, taskModel } = createHarness();
    taskModel.findById.mockResolvedValue({
      _id: TASK_ID,
      assignedTo: USER_ID,
      status: 'cancelled',
    });
    taskModel.findOneAndUpdate.mockResolvedValue({
      _id: TASK_ID,
      assignedTo: USER_ID,
      status: 'todo',
    });

    await service.updateStatus(TASK_ID, 'todo', {
      _id: MANAGER_ID,
      role: 'manager',
    });

    expect(taskModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: TASK_ID, status: 'cancelled' },
      { $set: { status: 'todo' } },
      { new: true, runValidators: true },
    );
  });

  it('báo xung đột nếu trạng thái đổi trong lúc cập nhật', async () => {
    const { service, taskModel } = createHarness();
    taskModel.findById.mockResolvedValue({
      _id: TASK_ID,
      assignedTo: USER_ID,
      status: 'todo',
    });
    taskModel.findOneAndUpdate.mockResolvedValue(null);

    await expect(
      service.updateStatus(TASK_ID, 'in_progress', {
        _id: USER_ID,
        role: 'user',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('giao việc bằng điều kiện trạng thái để không đè cập nhật đồng thời', async () => {
    const { service, taskModel, userClient } = createHarness();
    taskModel.findById.mockResolvedValue({
      _id: TASK_ID,
      assignedTo: USER_ID,
      status: 'in_progress',
    });
    userClient.exists.mockResolvedValue(true);
    const updated = {
      _id: TASK_ID,
      assignedTo: OTHER_USER_ID,
      status: 'in_progress',
    };
    taskModel.findOneAndUpdate.mockResolvedValue(updated);

    await expect(
      service.assign(TASK_ID, { assignedTo: OTHER_USER_ID }, 'request-5'),
    ).resolves.toEqual({
      message: 'Giao lại công việc thành công',
      task: updated,
    });
    expect(taskModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: TASK_ID, status: 'in_progress', assignedTo: USER_ID },
      { $set: { assignedTo: OTHER_USER_ID } },
      { new: true, runValidators: true },
    );
  });

  it('báo xung đột nếu việc bị đổi trong lúc giao lại', async () => {
    const { service, taskModel, userClient } = createHarness();
    taskModel.findById.mockResolvedValue({
      _id: TASK_ID,
      assignedTo: USER_ID,
      status: 'todo',
    });
    userClient.exists.mockResolvedValue(true);
    taskModel.findOneAndUpdate.mockResolvedValue(null);

    await expect(
      service.assign(TASK_ID, { assignedTo: OTHER_USER_ID }, 'request-race'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it.each(['done', 'cancelled'] as const)(
    'không giao lại công việc ở trạng thái %s',
    async (status) => {
      const { service, taskModel, userClient } = createHarness();
      taskModel.findById.mockResolvedValue({
        _id: TASK_ID,
        assignedTo: USER_ID,
        status,
      });

      await expect(
        service.assign(TASK_ID, { assignedTo: OTHER_USER_ID }, 'request-6'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(userClient.exists).not.toHaveBeenCalled();
      expect(taskModel.findOneAndUpdate).not.toHaveBeenCalled();
    },
  );
});
