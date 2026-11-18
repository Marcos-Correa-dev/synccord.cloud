import { Injectable, Inject } from '@nestjs/common';
import { Channel } from '../../domain/entities/channel.entity';
import { ListGuildChannelsUseCase } from '../ports/in/list-guild-channels.use-case';
import { ChannelRepositoryPort, CHANNEL_REPOSITORY_PORT } from '../ports/out/channel-repository.port';

@Injectable()
export class ListGuildChannelsService implements ListGuildChannelsUseCase {
  constructor(
    @Inject(CHANNEL_REPOSITORY_PORT)
    private readonly channelRepository: ChannelRepositoryPort,
  ) {}

  async execute(guildId: string): Promise<Channel[]> {
    return this.channelRepository.findByGuildId(guildId);
  }
}
