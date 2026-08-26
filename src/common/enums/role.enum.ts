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

export function isManagementRole(role: string | undefined): boolean {
  if (!role) return false;
  return MANAGEMENT_ROLES.includes(role.toLowerCase() as Role);
}
