import { Injectable, Inject } from '@nestjs/common';
import { Message } from '../../domain/entities/message.entity';
import { ListChannelMessagesQuery, ListChannelMessagesUseCase } from '../ports/in/list-channel-messages.use-case';
import { MessageRepositoryPort, MESSAGE_REPOSITORY_PORT } from '../ports/out/message-repository.port';

@Injectable()
export class ListChannelMessagesService implements ListChannelMessagesUseCase {
  constructor(
    @Inject(MESSAGE_REPOSITORY_PORT)
    private readonly messageRepository: MessageRepositoryPort,
  ) {}

  async execute(query: ListChannelMessagesQuery): Promise<Message[]> {
    const limit = Math.min(query.limit ?? 50, 100);
    return this.messageRepository.findByChannelId(query.channelId, limit, query.beforeId);
  }
}
