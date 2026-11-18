import { Guild } from '../../../domain/entities/guild.entity';

export const JOIN_GUILD_USE_CASE = 'JOIN_GUILD_USE_CASE';

export interface JoinGuildUseCase {
  execute(guildId: string, userId: string): Promise<Guild>;
}
