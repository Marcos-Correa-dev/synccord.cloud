import { Injectable, Inject } from '@nestjs/common';
import { Guild } from '../../domain/entities/guild.entity';
import { CreateGuildCommand, CreateGuildUseCase } from '../ports/in/create-guild.use-case';
import { GuildRepositoryPort, GUILD_REPOSITORY_PORT } from '../ports/out/guild-repository.port';
import { Snowflake } from '@shared/snowflake/snowflake';

@Injectable()
export class CreateGuildService implements CreateGuildUseCase {
  constructor(
    @Inject(GUILD_REPOSITORY_PORT)
    private readonly guildRepository: GuildRepositoryPort,
  ) {}

  async execute(command: CreateGuildCommand): Promise<Guild> {
    const guildId = Snowflake.generate();
    const guild = new Guild(
      guildId,
      command.name,
      command.ownerId,
      command.icon || null,
      command.description || null,
    );

    const createdGuild = await this.guildRepository.create(guild);
    // Add owner as a member
    await this.guildRepository.addMember(guildId, command.ownerId, ['owner']);
    // Provision standard default channels (e.g., #general and Voice General)
    await this.guildRepository.createDefaultChannels(guildId);

    return createdGuild;
  }
}
