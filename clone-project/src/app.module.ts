import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { RedisModule } from '@infrastructure/redis/redis.module';
import { AuthModule } from '@modules/auth/auth.module';
import { GuildsModule } from '@modules/guilds/guilds.module';
import { ChannelsModule } from '@modules/channels/channels.module';
import { MessagesModule } from '@modules/messages/messages.module';
import { GatewayModule } from '@modules/gateway/gateway.module';
import { RolesModule } from '@modules/roles/roles.module';
import { VoiceModule } from '@modules/voice/voice.module';
import { ConnectionsModule } from '@modules/connections/connections.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    AuthModule,
    GuildsModule,
    ChannelsModule,
    MessagesModule,
    RolesModule,
    VoiceModule,
    ConnectionsModule,
    GatewayModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
