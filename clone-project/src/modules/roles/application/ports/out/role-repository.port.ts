import { Role } from '../../../domain/entities/role.entity';
import { ChannelOverwrite } from '../../../domain/entities/channel-overwrite.entity';

export const ROLE_REPOSITORY_PORT = 'ROLE_REPOSITORY_PORT';

export interface RoleRepositoryPort {
  create(role: Role): Promise<Role>;
  findById(id: string): Promise<Role | null>;
  findByGuildId(guildId: string): Promise<Role[]>;
  update(role: Role): Promise<Role>;
  delete(id: string): Promise<void>;
  addRoleToMember(guildId: string, userId: string, roleId: string): Promise<void>;
  removeRoleFromMember(guildId: string, userId: string, roleId: string): Promise<void>;
  getMemberRoleIds(guildId: string, userId: string): Promise<string[]>;
  saveChannelOverwrite(overwrite: ChannelOverwrite): Promise<ChannelOverwrite>;
  findChannelOverwrites(channelId: string): Promise<ChannelOverwrite[]>;
  deleteChannelOverwrite(channelId: string, targetId: string): Promise<void>;
}
