import { Module, Global } from '@nestjs/common';
import { DiscordGateway } from './discord.gateway';
import { GatewayStateService } from './gateway-state.service';
import { WebsocketMessageEventPublisher } from './websocket-message-event-publisher';
import { MESSAGE_EVENT_PUBLISHER_PORT } from '@modules/messages/application/ports/out/message-event-publisher.port';

@Global()
@Module({
  providers: [
    GatewayStateService,
    DiscordGateway,
    {
      provide: MESSAGE_EVENT_PUBLISHER_PORT,
      useClass: WebsocketMessageEventPublisher,
    },
  ],
  exports: [GatewayStateService, DiscordGateway, MESSAGE_EVENT_PUBLISHER_PORT],
})
export class GatewayModule {}
