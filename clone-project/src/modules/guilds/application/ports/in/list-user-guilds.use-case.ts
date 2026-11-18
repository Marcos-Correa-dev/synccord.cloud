import { Guild } from '../../../domain/entities/guild.entity';

export const LIST_USER_GUILDS_USE_CASE = 'LIST_USER_GUILDS_USE_CASE';

export interface ListUserGuildsUseCase {
  execute(userId: string): Promise<Guild[]>;
}
