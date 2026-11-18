import { Channel } from '../../../domain/entities/channel.entity';

export interface CreateChannelCommand {
  guildId: string;
  name: string;
  type?: number;
  topic?: string;
  parentId?: string;
}

export const CREATE_CHANNEL_USE_CASE = 'CREATE_CHANNEL_USE_CASE';

export interface CreateChannelUseCase {
  execute(command: CreateChannelCommand): Promise<Channel>;
}
