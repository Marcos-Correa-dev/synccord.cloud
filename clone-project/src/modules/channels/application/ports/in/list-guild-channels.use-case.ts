import { Channel } from '../../../domain/entities/channel.entity';

export const LIST_GUILD_CHANNELS_USE_CASE = 'LIST_GUILD_CHANNELS_USE_CASE';

export interface ListGuildChannelsUseCase {
  execute(guildId: string): Promise<Channel[]>;
}
