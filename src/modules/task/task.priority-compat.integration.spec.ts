import { randomUUID } from 'node:crypto';
import { createConnection, type Connection, Types } from 'mongoose';
import { Task, TaskSchema, type TaskDocument } from '../../schemas/task.schema';
import type { UserClientService } from '../user-client/user-client.service';
import { TaskService } from './task.service';

const mongoUrl = process.env.TODO_TEST_MONGO_URL;
const integration = mongoUrl ? describe : describe.skip;

integration('Priority sorting with existing production tasks', () => {
  let connection: Connection;
  let service: TaskService;
  const assignedTo = new Types.ObjectId();
  const createdBy = new Types.ObjectId();

  beforeAll(async () => {
    connection = await createConnection(mongoUrl!, {
      dbName: `todo_priority_test_${randomUUID().replaceAll('-', '')}`,
    }).asPromise();
    const model = connection.model<TaskDocument>(Task.name, TaskSchema);
    // Raw inserts represent documents saved before priorityOrder/progress existed.
    await model.collection.insertMany(
      ['high', 'medium', 'low'].map((priority) => ({
        title: priority,
        priority,
        status: 'todo',
        assignedTo,
        createdBy,
      })),
    );
    await model.create({
      title: 'urgent',
      priority: 'urgent',
      priorityOrder: 4,
      status: 'todo',
      assignedTo,
      createdBy,
    });
    await model.create({
      title: 'other user',
      priority: 'urgent',
      priorityOrder: 4,
      status: 'todo',
      assignedTo: new Types.ObjectId(),
      createdBy,
    });
    const userClient = {
      enrichTasks: jest.fn((tasks: Record<string, unknown>[]) =>
        Promise.resolve(tasks),
      ),
    };
    service = new TaskService(
      model,
      userClient as unknown as UserClientService,
    );
  });

  afterAll(async () => {
    if (connection) {
      await connection.dropDatabase();
      await connection.close();
    }
  });

  it('sorts legacy and new tasks by priority without leaking another assignee', async () => {
    const result = await service.findMine(
      { _id: assignedTo.toHexString(), role: 'user' },
      { sortBy: 'priority', order: 'desc', page: 1, limit: 20 },
      undefined,
      'priority-compat',
    );
    expect(result.tasks.map((task) => task.title)).toEqual([
      'urgent',
      'high',
      'medium',
      'low',
    ]);
    expect(result.pagination.total).toBe(4);
  });

  it('keeps assignee/creator filters and pagination when sorting ascending', async () => {
    const result = await service.findAll(
      {
        assignedTo: assignedTo.toHexString(),
        createdBy: createdBy.toHexString(),
        sortBy: 'priority',
        order: 'asc',
        page: 2,
        limit: 2,
      },
      undefined,
      'priority-compat-page',
    );
    expect(result.tasks.map((task) => task.title)).toEqual(['high', 'urgent']);
    expect(result.pagination).toEqual({
      page: 2,
      limit: 2,
      total: 4,
      totalPages: 2,
    });
  });
});
