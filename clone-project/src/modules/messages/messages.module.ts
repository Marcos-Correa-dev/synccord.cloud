import { Module } from '@nestjs/common';
import { MessagesController } from './infrastructure/adapters/in/controllers/messages.controller';
import { SendMessageService } from './application/use-cases/send-message.service';
import { ListChannelMessagesService } from './application/use-cases/list-channel-messages.service';
import { SEND_MESSAGE_USE_CASE } from './application/ports/in/send-message.use-case';
import { LIST_CHANNEL_MESSAGES_USE_CASE } from './application/ports/in/list-channel-messages.use-case';
import { MESSAGE_REPOSITORY_PORT } from './application/ports/out/message-repository.port';
import { DrizzleMessageRepository } from './infrastructure/adapters/out/persistence/drizzle-message.repository';
import { AuthModule } from '@modules/auth/auth.module';
import { GatewayModule } from '@modules/gateway/gateway.module';

@Module({
  imports: [AuthModule, GatewayModule],
  controllers: [MessagesController],
  providers: [
    {
      provide: SEND_MESSAGE_USE_CASE,
      useClass: SendMessageService,
    },
    {
      provide: LIST_CHANNEL_MESSAGES_USE_CASE,
      useClass: ListChannelMessagesService,
    },
    {
      provide: MESSAGE_REPOSITORY_PORT,
      useClass: DrizzleMessageRepository,
    },
  ],
  exports: [MESSAGE_REPOSITORY_PORT, SEND_MESSAGE_USE_CASE],
})
export class MessagesModule {}
