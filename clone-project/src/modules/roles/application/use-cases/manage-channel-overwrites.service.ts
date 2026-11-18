import { Injectable, Inject } from '@nestjs/common';
import { ChannelOverwrite } from '../../domain/entities/channel-overwrite.entity';
import {
  SetChannelOverwriteCommand,
  ManageChannelOverwritesUseCase,
} from '../ports/in/manage-channel-overwrites.use-case';
import { RoleRepositoryPort, ROLE_REPOSITORY_PORT } from '../ports/out/role-repository.port';
import { Snowflake } from '@shared/snowflake/snowflake';

@Injectable()
export class ManageChannelOverwritesService implements ManageChannelOverwritesUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY_PORT)
    private readonly roleRepository: RoleRepositoryPort,
  ) {}

  async setOverwrite(command: SetChannelOverwriteCommand): Promise<ChannelOverwrite> {
    const id = Snowflake.generate();
    const overwrite = new ChannelOverwrite(
      id,
      command.channelId,
      command.targetId,
      command.type,
      command.allow ?? '0',
      command.deny ?? '0',
      new Date(),
    );

    return this.roleRepository.saveChannelOverwrite(overwrite);
  }

  async listOverwrites(channelId: string): Promise<ChannelOverwrite[]> {
    return this.roleRepository.findChannelOverwrites(channelId);
  }

  async deleteOverwrite(channelId: string, targetId: string): Promise<void> {
    await this.roleRepository.deleteChannelOverwrite(channelId, targetId);
  }
}
