import { ChannelOverwrite, OverwriteType } from '@modules/roles/domain/entities/channel-overwrite.entity';

export const MANAGE_CHANNEL_OVERWRITES_USE_CASE = 'MANAGE_CHANNEL_OVERWRITES_USE_CASE';

export interface SetChannelOverwriteCommand {
  channelId: string;
  targetId: string;
  type: OverwriteType;
  allow?: string;
  deny?: string;
}

export interface ManageChannelOverwritesUseCase {
  setOverwrite(command: SetChannelOverwriteCommand): Promise<ChannelOverwrite>;
  listOverwrites(channelId: string): Promise<ChannelOverwrite[]>;
  deleteOverwrite(channelId: string, targetId: string): Promise<void>;
}
