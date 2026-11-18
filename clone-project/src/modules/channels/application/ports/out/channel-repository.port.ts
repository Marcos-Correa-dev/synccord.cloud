import { Channel } from '../../../domain/entities/channel.entity';

export const CHANNEL_REPOSITORY_PORT = 'CHANNEL_REPOSITORY_PORT';

export interface ChannelRepositoryPort {
  create(channel: Channel): Promise<Channel>;
  findById(id: string): Promise<Channel | null>;
  findByGuildId(guildId: string): Promise<Channel[]>;
}
