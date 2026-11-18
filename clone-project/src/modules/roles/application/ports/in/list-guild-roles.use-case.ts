import { Role } from '@modules/roles/domain/entities/role.entity';

export const LIST_GUILD_ROLES_USE_CASE = 'LIST_GUILD_ROLES_USE_CASE';

export interface ListGuildRolesUseCase {
  execute(guildId: string): Promise<Role[]>;
}
