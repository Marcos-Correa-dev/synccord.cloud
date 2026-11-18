import { Role } from '@modules/roles/domain/entities/role.entity';

export const CREATE_ROLE_USE_CASE = 'CREATE_ROLE_USE_CASE';

export interface CreateRoleCommand {
  guildId: string;
  name: string;
  color?: number;
  hoist?: boolean;
  position?: number;
  permissions?: string;
  mentionable?: boolean;
}

export interface CreateRoleUseCase {
  execute(command: CreateRoleCommand): Promise<Role>;
}
