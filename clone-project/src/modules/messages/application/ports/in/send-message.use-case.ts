import { Message } from '../../../domain/entities/message.entity';

export interface SendMessageCommand {
  channelId: string;
  authorId: string;
  content: string;
}

export const SEND_MESSAGE_USE_CASE = 'SEND_MESSAGE_USE_CASE';

export interface SendMessageUseCase {
  execute(command: SendMessageCommand): Promise<Message>;
}
