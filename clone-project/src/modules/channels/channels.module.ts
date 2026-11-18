import { Module } from '@nestjs/common';
import { ChannelsController } from './infrastructure/adapters/in/controllers/channels.controller';
import { CreateChannelService } from './application/use-cases/create-channel.service';
import { ListGuildChannelsService } from './application/use-cases/list-guild-channels.service';
import { CREATE_CHANNEL_USE_CASE } from './application/ports/in/create-channel.use-case';
import { LIST_GUILD_CHANNELS_USE_CASE } from './application/ports/in/list-guild-channels.use-case';
import { CHANNEL_REPOSITORY_PORT } from './application/ports/out/channel-repository.port';
import { DrizzleChannelRepository } from './infrastructure/adapters/out/persistence/drizzle-channel.repository';
import { AuthModule } from '@modules/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ChannelsController],
  providers: [
    {
      provide: CREATE_CHANNEL_USE_CASE,
      useClass: CreateChannelService,
    },
    {
      provide: LIST_GUILD_CHANNELS_USE_CASE,
      useClass: ListGuildChannelsService,
    },
    {
      provide: CHANNEL_REPOSITORY_PORT,
      useClass: DrizzleChannelRepository,
    },
  ],
  exports: [CHANNEL_REPOSITORY_PORT, CREATE_CHANNEL_USE_CASE],
})
export class ChannelsModule {}
