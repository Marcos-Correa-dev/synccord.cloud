import { Channel } from '../../../domain/entities/channel.entity';

export const CHANNEL_REPOSITORY_PORT = 'CHANNEL_REPOSITORY_PORT';

export interface DmChannelSummary {
  id: string;
  type: number;
  name: string;
  recipient: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
  };
  createdAt: Date;
}

export interface MutualContact {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  mutualGuildNames: string[];
}

export interface ChannelRepositoryPort {
  create(channel: Channel): Promise<Channel>;
  findById(id: string): Promise<Channel | null>;
  findByGuildId(guildId: string): Promise<Channel[]>;
  update(id: string, data: { name?: string; topic?: string | null }): Promise<Channel>;
  delete(id: string): Promise<void>;
  findOrCreateDmChannel(userId: string, recipientId: string): Promise<DmChannelSummary>;
  findUserDmChannels(userId: string): Promise<DmChannelSummary[]>;
  findMutualContacts(userId: string): Promise<MutualContact[]>;
}
