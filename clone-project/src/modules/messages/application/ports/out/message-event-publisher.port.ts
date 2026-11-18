import { Message } from '../../../domain/entities/message.entity';

export const MESSAGE_EVENT_PUBLISHER_PORT = 'MESSAGE_EVENT_PUBLISHER_PORT';

export interface MessageEventPublisherPort {
  publishMessageCreated(message: Message): Promise<void>;
}
