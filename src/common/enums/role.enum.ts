export enum Role {
  ADMIN = 'admin',
  MANAGER = 'manager',
  CHEF = 'chef',
  CASHIER = 'cashier',
  WAITER = 'waiter',
  USER = 'user',
  VIP = 'vip',
}

export const MANAGEMENT_ROLES = [Role.ADMIN, Role.MANAGER, Role.CHEF];
