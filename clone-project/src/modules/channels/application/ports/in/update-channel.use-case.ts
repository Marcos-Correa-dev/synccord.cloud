import { Channel } from '../../../domain/entities/channel.entity';

export interface UpdateChannelCommand {
  channelId: string;
  name?: string;
  topic?: string;
}

export const UPDATE_CHANNEL_USE_CASE = 'UPDATE_CHANNEL_USE_CASE';

export interface UpdateChannelUseCase {
  execute(command: UpdateChannelCommand): Promise<Channel>;
}
