import { Injectable, Inject } from '@nestjs/common';
import { Channel } from '../../domain/entities/channel.entity';
import { CreateChannelCommand, CreateChannelUseCase } from '../ports/in/create-channel.use-case';
import { ChannelRepositoryPort, CHANNEL_REPOSITORY_PORT } from '../ports/out/channel-repository.port';
import { Snowflake } from '@shared/snowflake/snowflake';

@Injectable()
export class CreateChannelService implements CreateChannelUseCase {
  constructor(
    @Inject(CHANNEL_REPOSITORY_PORT)
    private readonly channelRepository: ChannelRepositoryPort,
  ) {}

  async execute(command: CreateChannelCommand): Promise<Channel> {
    const id = Snowflake.generate();
    const isVoice = command.type === 2;
    const formattedName = isVoice
      ? command.name.trim()
      : command.name.toLowerCase().replace(/\s+/g, '-');

    const channel = new Channel(
      id,
      command.guildId,
      formattedName,
      command.type ?? 0,
      command.topic ?? null,
      0,
      command.parentId ?? null,
    );

    return this.channelRepository.create(channel);
  }
}
