import { Injectable } from '@nestjs/common';

export interface GatewayVoiceUser {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
}

export interface UserPresence {
  userId: string;
  username: string;
  discriminator: string;
  avatar?: string;
  status: 'online' | 'dnd' | 'idle' | 'invisible';
  duration?: number;
  expiresAt?: number | null;
}

export interface GatewayVoiceState {
  socketId: string;
  guildId: string;
  channelId: string | null;
  user: GatewayVoiceUser;
  selfMute: boolean;
  selfDeaf: boolean;
  speaking: boolean;
  streaming?: boolean;
  video?: boolean;
  screenTrackId?: string | null;
  cameraTrackId?: string | null;
}

@Injectable()
export class GatewayStateService {
  private readonly voiceStates = new Map<string, GatewayVoiceState>();
  private readonly userPresences = new Map<string, UserPresence>();

  public getAllVoiceStates(): GatewayVoiceState[] {
    return Array.from(this.voiceStates.values());
  }

  public getVoiceState(userId: string): GatewayVoiceState | undefined {
    return this.voiceStates.get(userId);
  }

  public setVoiceState(userId: string, state: GatewayVoiceState): void {
    this.voiceStates.set(userId, state);
  }

  public removeVoiceState(userId: string): GatewayVoiceState | undefined {
    const existing = this.voiceStates.get(userId);
    if (existing) {
      this.voiceStates.delete(userId);
    }
    return existing;
  }

  public removeVoiceStatesBySocketId(socketId: string): GatewayVoiceState[] {
    const removed: GatewayVoiceState[] = [];
    for (const [userId, state] of this.voiceStates.entries()) {
      if (state.socketId === socketId) {
        this.voiceStates.delete(userId);
        removed.push(state);
      }
    }
    return removed;
  }

  public updateSpeaking(userId: string, speaking: boolean): GatewayVoiceState | undefined {
    const state = this.voiceStates.get(userId);
    if (state) {
      state.speaking = speaking;
    }
    return state;
  }

  public updateStream(
    userId: string,
    update: {
      streaming?: boolean;
      video?: boolean;
      screenTrackId?: string | null;
      cameraTrackId?: string | null;
    },
  ): GatewayVoiceState | undefined {
    const state = this.voiceStates.get(userId);
    if (state) {
      if (typeof update.streaming === 'boolean') state.streaming = update.streaming;
      if (typeof update.video === 'boolean') state.video = update.video;
      if (update.screenTrackId !== undefined) state.screenTrackId = update.screenTrackId;
      if (update.cameraTrackId !== undefined) state.cameraTrackId = update.cameraTrackId;
    }
    return state;
  }

  public getAllPresences(): UserPresence[] {
    return Array.from(this.userPresences.values());
  }

  public setPresence(userId: string, presence: UserPresence): void {
    this.userPresences.set(userId, presence);
  }

  public updateUserProfile(
    userId: string,
    username: string,
    avatar?: string | null,
  ): { state?: GatewayVoiceState; presence?: UserPresence } {
    const state = this.voiceStates.get(userId);
    if (state) {
      state.user.username = username;
      state.user.avatar = avatar || undefined;
    }

    const presence = this.userPresences.get(userId);
    if (presence) {
      presence.username = username;
      if (avatar !== undefined) {
        presence.avatar = avatar || undefined;
      }
    }

    return { state, presence };
  }
}
