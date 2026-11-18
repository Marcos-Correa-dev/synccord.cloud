import { Injectable } from '@nestjs/common';
import { MessageEventPublisherPort } from '@modules/messages/application/ports/out/message-event-publisher.port';
import { Message } from '@modules/messages/domain/entities/message.entity';
import { DiscordGateway } from './discord.gateway';

@Injectable()
export class WebsocketMessageEventPublisher implements MessageEventPublisherPort {
  constructor(private readonly gateway: DiscordGateway) {}

  async publishMessageCreated(message: Message): Promise<void> {
    this.gateway.broadcastToChannel(message.channelId, 'MESSAGE_CREATE', {
      id: message.id,
      channel_id: message.channelId,
      author_id: message.authorId,
      author_name: message.authorName,
      author_avatar: message.authorAvatar,
      author_discriminator: message.authorDiscriminator,
      content: message.content,
      pinned: message.pinned,
      edited_timestamp: message.editedAt?.toISOString() ?? null,
      timestamp: message.createdAt.toISOString(),
    });
  }
}
