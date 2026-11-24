export const DELETE_CHANNEL_USE_CASE = 'DELETE_CHANNEL_USE_CASE';

export interface DeleteChannelUseCase {
  execute(channelId: string): Promise<{ deleted: boolean; id: string; guildId: string | null }>;
}
