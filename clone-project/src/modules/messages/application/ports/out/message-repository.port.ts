import { Message } from '../../../domain/entities/message.entity';

export const MESSAGE_REPOSITORY_PORT = 'MESSAGE_REPOSITORY_PORT';

export interface MessageRepositoryPort {
  create(message: Message): Promise<Message>;
  findById(id: string): Promise<Message | null>;
  findByChannelId(channelId: string, limit?: number, beforeId?: string): Promise<Message[]>;
}
