import { MANAGEMENT_ROLES, Role } from '../enums/role.enum';

export function isManagementRole(role: string | undefined): boolean {
  if (!role) return false;
  return MANAGEMENT_ROLES.includes(role.toLowerCase() as Role);
}
