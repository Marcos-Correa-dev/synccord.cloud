import { Guild } from '../../../domain/entities/guild.entity';

export const GUILD_REPOSITORY_PORT = 'GUILD_REPOSITORY_PORT';

export interface GuildMemberInfo {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

export interface GuildRepositoryPort {
  create(guild: Guild): Promise<Guild>;
  findById(id: string): Promise<Guild | null>;
  findByName(name: string): Promise<Guild | null>;
  findUserGuilds(userId: string): Promise<Guild[]>;
  addMember(guildId: string, userId: string, roles?: string[]): Promise<void>;
  findGuildMembers(guildId: string): Promise<GuildMemberInfo[]>;
  isMember(guildId: string, userId: string): Promise<boolean>;
  createDefaultChannels(guildId: string): Promise<void>;
}
