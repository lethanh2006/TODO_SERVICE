import { isManagementRole } from './role.enum';

describe('isManagementRole', () => {
  it.each(['admin', 'manager', 'chef', 'ADMIN'])(
    'nhận diện %s là vai trò quản trị',
    (role) => expect(isManagementRole(role)).toBe(true),
  );

  it.each(['user', 'vip', 'cashier', 'waiter', undefined])(
    'không cấp quyền quản trị cho %s',
    (role) => expect(isManagementRole(role)).toBe(false),
  );
});
