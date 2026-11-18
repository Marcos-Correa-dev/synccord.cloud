import { Guild } from '../../../domain/entities/guild.entity';

export interface CreateGuildCommand {
  name: string;
  ownerId: string;
  icon?: string;
  description?: string;
}

export const CREATE_GUILD_USE_CASE = 'CREATE_GUILD_USE_CASE';

export interface CreateGuildUseCase {
  execute(command: CreateGuildCommand): Promise<Guild>;
}
