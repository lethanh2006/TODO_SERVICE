import {
  AUTHENTICATED_KEY,
  MANAGEMENT_ROLES,
  ROLES_KEY,
} from '../../common/auth';
import { TaskController } from './task.controller';

describe('TaskController role contract', () => {
  it.each(['create', 'assign', 'update', 'getAll', 'remove'] as Array<
    keyof TaskController
  >)('cho phép khối quản trị gọi %s', (methodName) => {
    const handler = Object.getOwnPropertyDescriptor(
      TaskController.prototype,
      methodName,
    )?.value as object;

    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(MANAGEMENT_ROLES);
  });

  it.each(['getMyTasks', 'getOne', 'updateStatus'] as Array<
    keyof TaskController
  >)('yêu cầu đăng nhập khi gọi %s', (methodName) => {
    const handler = Object.getOwnPropertyDescriptor(
      TaskController.prototype,
      methodName,
    )?.value as object;

    expect(Reflect.getMetadata(AUTHENTICATED_KEY, handler)).toBe(true);
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toBeUndefined();
  });
});
