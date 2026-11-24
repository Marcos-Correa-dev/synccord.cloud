import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Channel } from '../../domain/entities/channel.entity';
import { UpdateChannelCommand, UpdateChannelUseCase } from '../ports/in/update-channel.use-case';
import { ChannelRepositoryPort, CHANNEL_REPOSITORY_PORT } from '../ports/out/channel-repository.port';

@Injectable()
export class UpdateChannelService implements UpdateChannelUseCase {
  constructor(
    @Inject(CHANNEL_REPOSITORY_PORT)
    private readonly channelRepository: ChannelRepositoryPort,
  ) {}

  async execute(command: UpdateChannelCommand): Promise<Channel> {
    const existing = await this.channelRepository.findById(command.channelId);
    if (!existing) {
      throw new NotFoundException('Canal não encontrado.');
    }

    const isVoice = existing.type === 2;
    let formattedName = existing.name;
    if (command.name !== undefined && command.name.trim()) {
      formattedName = isVoice
        ? command.name.trim()
        : command.name.trim().toLowerCase().replace(/\s+/g, '-');
    }

    const updatedTopic = command.topic !== undefined ? command.topic : existing.topic;

    return this.channelRepository.update(existing.id, {
      name: formattedName,
      topic: updatedTopic,
    });
  }
}
