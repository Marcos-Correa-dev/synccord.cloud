import { Injectable, Inject } from '@nestjs/common';
import { ListGuildMembersUseCase } from '../ports/in/list-guild-members.use-case';
import { GuildRepositoryPort, GUILD_REPOSITORY_PORT, GuildMemberInfo } from '../ports/out/guild-repository.port';

@Injectable()
export class ListGuildMembersService implements ListGuildMembersUseCase {
  constructor(
    @Inject(GUILD_REPOSITORY_PORT)
    private readonly guildRepository: GuildRepositoryPort,
  ) {}

  async execute(guildId: string): Promise<GuildMemberInfo[]> {
    return this.guildRepository.findGuildMembers(guildId);
  }
}
