import { Injectable, Inject } from '@nestjs/common';
import { Message } from '../../domain/entities/message.entity';
import { SendMessageCommand, SendMessageUseCase } from '../ports/in/send-message.use-case';
import { MessageRepositoryPort, MESSAGE_REPOSITORY_PORT } from '../ports/out/message-repository.port';
import { MessageEventPublisherPort, MESSAGE_EVENT_PUBLISHER_PORT } from '../ports/out/message-event-publisher.port';
import { Snowflake } from '@shared/snowflake/snowflake';

@Injectable()
export class SendMessageService implements SendMessageUseCase {
  constructor(
    @Inject(MESSAGE_REPOSITORY_PORT)
    private readonly messageRepository: MessageRepositoryPort,
    @Inject(MESSAGE_EVENT_PUBLISHER_PORT)
    private readonly eventPublisher: MessageEventPublisherPort,
  ) {}

  async execute(command: SendMessageCommand): Promise<Message> {
    const id = Snowflake.generate();
    const message = new Message(
      id,
      command.channelId,
      command.authorId,
      command.content,
    );

    const savedMessage = await this.messageRepository.create(message);
    const populated = await this.messageRepository.findById(savedMessage.id);
    const messageToPublish = populated ?? savedMessage;
    // Push event to WebSocket Gateway & Subscribers
    await this.eventPublisher.publishMessageCreated(messageToPublish);

    return messageToPublish;
  }
}
