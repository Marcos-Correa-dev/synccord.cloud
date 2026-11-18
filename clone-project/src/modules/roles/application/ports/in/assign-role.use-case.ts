export const ASSIGN_ROLE_USE_CASE = 'ASSIGN_ROLE_USE_CASE';

export interface AssignRoleCommand {
  guildId: string;
  userId: string;
  roleId: string;
}

export interface AssignRoleUseCase {
  assignRole(command: AssignRoleCommand): Promise<void>;
  removeRole(command: AssignRoleCommand): Promise<void>;
}
