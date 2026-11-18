import { Module, Global } from '@nestjs/common';
import { DiscordGateway } from './discord.gateway';
import { WebsocketMessageEventPublisher } from './websocket-message-event-publisher';
import { MESSAGE_EVENT_PUBLISHER_PORT } from '@modules/messages/application/ports/out/message-event-publisher.port';

@Global()
@Module({
  providers: [
    DiscordGateway,
    {
      provide: MESSAGE_EVENT_PUBLISHER_PORT,
      useClass: WebsocketMessageEventPublisher,
    },
  ],
  exports: [DiscordGateway, MESSAGE_EVENT_PUBLISHER_PORT],
})
export class GatewayModule {}
