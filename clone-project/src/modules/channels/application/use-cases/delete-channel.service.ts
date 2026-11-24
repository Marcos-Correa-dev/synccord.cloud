import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DeleteChannelUseCase } from '../ports/in/delete-channel.use-case';
import { ChannelRepositoryPort, CHANNEL_REPOSITORY_PORT } from '../ports/out/channel-repository.port';

@Injectable()
export class DeleteChannelService implements DeleteChannelUseCase {
  constructor(
    @Inject(CHANNEL_REPOSITORY_PORT)
    private readonly channelRepository: ChannelRepositoryPort,
  ) {}

  async execute(channelId: string): Promise<{ deleted: boolean; id: string; guildId: string | null }> {
    const existing = await this.channelRepository.findById(channelId);
    if (!existing) {
      throw new NotFoundException('Canal não encontrado.');
    }

    await this.channelRepository.delete(channelId);
    return {
      deleted: true,
      id: existing.id,
      guildId: existing.guildId,
    };
  }
}
