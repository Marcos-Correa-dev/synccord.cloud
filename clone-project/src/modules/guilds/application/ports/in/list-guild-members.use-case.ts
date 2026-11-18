import { GuildMemberInfo } from '../out/guild-repository.port';

export const LIST_GUILD_MEMBERS_USE_CASE = 'LIST_GUILD_MEMBERS_USE_CASE';

export interface ListGuildMembersUseCase {
  execute(guildId: string): Promise<GuildMemberInfo[]>;
}
