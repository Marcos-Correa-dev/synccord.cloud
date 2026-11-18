import { Injectable, Inject } from '@nestjs/common';
import { Guild } from '../../domain/entities/guild.entity';
import { ListUserGuildsUseCase } from '../ports/in/list-user-guilds.use-case';
import { GuildRepositoryPort, GUILD_REPOSITORY_PORT } from '../ports/out/guild-repository.port';

@Injectable()
export class ListUserGuildsService implements ListUserGuildsUseCase {
  constructor(
    @Inject(GUILD_REPOSITORY_PORT)
    private readonly guildRepository: GuildRepositoryPort,
  ) {}

  async execute(userId: string): Promise<Guild[]> {
    return this.guildRepository.findUserGuilds(userId);
  }
}
