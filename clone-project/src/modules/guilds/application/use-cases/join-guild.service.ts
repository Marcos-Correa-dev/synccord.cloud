import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Guild } from '../../domain/entities/guild.entity';
import { JoinGuildUseCase } from '../ports/in/join-guild.use-case';
import { GuildRepositoryPort, GUILD_REPOSITORY_PORT } from '../ports/out/guild-repository.port';

@Injectable()
export class JoinGuildService implements JoinGuildUseCase {
  constructor(
    @Inject(GUILD_REPOSITORY_PORT)
    private readonly guildRepository: GuildRepositoryPort,
  ) {}

  async execute(guildIdOrName: string, userId: string): Promise<Guild> {
    let guild = await this.guildRepository.findById(guildIdOrName);
    if (!guild) {
      guild = await this.guildRepository.findByName(guildIdOrName);
    }
    if (!guild) {
      throw new NotFoundException('Servidor não encontrado');
    }

    await this.guildRepository.addMember(guild.id, userId);
    return guild;
  }
}
