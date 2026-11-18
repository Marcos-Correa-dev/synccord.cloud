import { Message } from '../../../domain/entities/message.entity';

export interface ListChannelMessagesQuery {
  channelId: string;
  limit?: number;
  beforeId?: string;
}

export const LIST_CHANNEL_MESSAGES_USE_CASE = 'LIST_CHANNEL_MESSAGES_USE_CASE';

export interface ListChannelMessagesUseCase {
  execute(query: ListChannelMessagesQuery): Promise<Message[]>;
}
