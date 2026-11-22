import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { GatewayOpcode } from '@shared/constants/discord.constants';

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
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class DiscordGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  public server: Server;

  private readonly logger = new Logger(DiscordGateway.name);
  private readonly voiceStates = new Map<string, GatewayVoiceState>();
  private readonly userPresences = new Map<string, UserPresence>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to Gateway: ${client.id}`);

    // Send OP 10 HELLO on connection (like Discord)
    client.emit('packet', {
      op: GatewayOpcode.HELLO,
      d: {
        heartbeat_interval: 41250,
      },
    });

    // Send current active voice states to new connection
    client.emit('packet', {
      op: GatewayOpcode.DISPATCH,
      t: 'VOICE_STATES_SYNC',
      d: Array.from(this.voiceStates.values()),
    });

    // Send current active presences to new connection
    client.emit('packet', {
      op: GatewayOpcode.DISPATCH,
      t: 'PRESENCES_SYNC',
      d: Array.from(this.userPresences.values()),
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from Gateway: ${client.id}`);

    // Clean up voice state if disconnected client was in voice
    for (const [userId, state] of this.voiceStates.entries()) {
      if (state.socketId === client.id) {
        this.voiceStates.delete(userId);
        this.server.emit('packet', {
          op: GatewayOpcode.DISPATCH,
          t: 'VOICE_STATE_UPDATE',
          d: {
            guildId: state.guildId,
            channelId: null,
            userId,
          },
        });
      }
    }
  }

  @SubscribeMessage('heartbeat')
  handleHeartbeat(client: Socket, _payload: unknown) {
    // Respond with OP 11 HEARTBEAT_ACK
    client.emit('packet', {
      op: GatewayOpcode.HEARTBEAT_ACK,
      d: null,
    });
  }

  @SubscribeMessage('channel:join')
  handleJoinChannel(client: Socket, channelId: string) {
    client.join(`channel:${channelId}`);
    return { status: 'joined', channelId };
  }

  @SubscribeMessage('channel:leave')
  handleLeaveChannel(client: Socket, channelId: string) {
    client.leave(`channel:${channelId}`);
    return { status: 'left', channelId };
  }

  @SubscribeMessage('voice:join')
  handleVoiceJoin(
    client: Socket,
    payload: {
      guildId: string;
      channelId: string;
      user: GatewayVoiceUser;
      selfMute?: boolean;
      selfDeaf?: boolean;
    },
  ) {
    const userId = String(payload.user.id);
    const existing = this.voiceStates.get(userId);
    if (existing && existing.channelId && existing.channelId !== payload.channelId) {
      client.leave(`voice:${existing.channelId}`);
    }

    const state: GatewayVoiceState = {
      socketId: client.id,
      guildId: payload.guildId,
      channelId: payload.channelId,
      user: payload.user,
      selfMute: payload.selfMute ?? false,
      selfDeaf: payload.selfDeaf ?? false,
      speaking: false,
    };

    this.voiceStates.set(userId, state);
    client.join(`voice:${payload.channelId}`);
    client.join(`channel:${payload.channelId}`);

    this.server.emit('packet', {
      op: GatewayOpcode.DISPATCH,
      t: 'VOICE_STATE_UPDATE',
      d: state,
    });

    return { status: 'ok', state };
  }

  @SubscribeMessage('voice:leave')
  handleVoiceLeave(
    client: Socket,
    payload: { guildId?: string; channelId?: string; userId: string },
  ) {
    const userId = String(payload.userId);
    const state = this.voiceStates.get(userId);
    if (state && state.channelId) {
      client.leave(`voice:${state.channelId}`);
      client.leave(`channel:${state.channelId}`);
      this.voiceStates.delete(userId);
      this.server.emit('packet', {
        op: GatewayOpcode.DISPATCH,
        t: 'VOICE_STATE_UPDATE',
        d: {
          guildId: state.guildId,
          channelId: null,
          userId,
        },
      });
    }
    return { status: 'ok' };
  }

  @SubscribeMessage('voice:speaking')
  handleVoiceSpeaking(
    _client: Socket,
    payload: { channelId: string; userId: string; speaking: boolean },
  ) {
    const userId = String(payload.userId);
    const state = this.voiceStates.get(userId);
    if (state) {
      state.speaking = payload.speaking;
      this.server.to(`voice:${payload.channelId}`).emit('packet', {
        op: GatewayOpcode.DISPATCH,
        t: 'VOICE_SPEAKING',
        d: payload,
      });
    }
  }

  @SubscribeMessage('voice:stream_update')
  handleVoiceStreamUpdate(
    _client: Socket,
    payload: {
      channelId: string;
      userId: string;
      streaming?: boolean;
      video?: boolean;
      username?: string;
      screenTrackId?: string | null;
      cameraTrackId?: string | null;
    },
  ) {
    const userId = String(payload.userId);
    const state = this.voiceStates.get(userId);
    if (state) {
      if (typeof payload.streaming === 'boolean') state.streaming = payload.streaming;
      if (typeof payload.video === 'boolean') state.video = payload.video;
      if (payload.screenTrackId !== undefined) state.screenTrackId = payload.screenTrackId;
      if (payload.cameraTrackId !== undefined) state.cameraTrackId = payload.cameraTrackId;

      this.server.emit('packet', {
        op: GatewayOpcode.DISPATCH,
        t: 'VOICE_STREAM_UPDATE',
        d: {
          channelId: payload.channelId,
          userId,
          username: payload.username || state.user.username,
          streaming: state.streaming ?? false,
          video: state.video ?? false,
          screenTrackId: state.screenTrackId ?? null,
          cameraTrackId: state.cameraTrackId ?? null,
        },
      });
    }
  }

  @SubscribeMessage('voice:signal')
  handleVoiceSignal(
    _client: Socket,
    payload: { to?: string; from: string; channelId?: string; signal: unknown; type?: string },
  ) {
    if (payload.to) {
      const targetState = this.voiceStates.get(String(payload.to));
      if (targetState?.socketId) {
        this.server.to(targetState.socketId).emit('packet', {
          op: GatewayOpcode.DISPATCH,
          t: 'VOICE_SIGNAL',
          d: payload,
        });
        return;
      }
    }

    if (payload.channelId) {
      this.server.to(`voice:${payload.channelId}`).emit('packet', {
        op: GatewayOpcode.DISPATCH,
        t: 'VOICE_SIGNAL',
        d: payload,
      });
    } else {
      this.server.emit('packet', {
        op: GatewayOpcode.DISPATCH,
        t: 'VOICE_SIGNAL',
        d: payload,
      });
    }
  }

  @SubscribeMessage('presence:update')
  handlePresenceUpdate(
    _client: Socket,
    payload: UserPresence,
  ) {
    this.userPresences.set(payload.userId, payload);
    this.server.emit('packet', {
      op: GatewayOpcode.DISPATCH,
      t: 'PRESENCE_UPDATE',
      d: payload,
    });
  }

  @SubscribeMessage('presence:get_all')
  handleGetAllPresences(client: Socket) {
    client.emit('packet', {
      op: GatewayOpcode.DISPATCH,
      t: 'PRESENCES_SYNC',
      d: Array.from(this.userPresences.values()),
    });
  }

  @SubscribeMessage('voice:get_states')
  handleGetVoiceStates(client: Socket) {
    client.emit('packet', {
      op: GatewayOpcode.DISPATCH,
      t: 'VOICE_STATES_SYNC',
      d: Array.from(this.voiceStates.values()),
    });
  }

  @SubscribeMessage('voice:sound')
  handleVoiceSound(
    _client: Socket,
    payload: { channelId: string; userId: string; sound: string; emoji: string },
  ) {
    this.server.to(`voice:${payload.channelId}`).emit('packet', {
      op: GatewayOpcode.DISPATCH,
      t: 'VOICE_SOUND',
      d: payload,
    });
  }

  @SubscribeMessage('voice:reaction')
  handleVoiceReaction(
    _client: Socket,
    payload: { channelId: string; userId: string; emoji: string },
  ) {
    this.server.to(`voice:${payload.channelId}`).emit('packet', {
      op: GatewayOpcode.DISPATCH,
      t: 'VOICE_REACTION',
      d: payload,
    });
  }

  @SubscribeMessage('user:update_profile')
  handleUserUpdateProfile(
    _client: Socket,
    payload: { userId: string; username: string; avatar?: string | null },
  ) {
    const state = this.voiceStates.get(payload.userId);
    if (state) {
      state.user.username = payload.username;
      state.user.avatar = payload.avatar || undefined;
      this.server.emit('packet', {
        op: GatewayOpcode.DISPATCH,
        t: 'VOICE_STATE_UPDATE',
        d: state,
      });
    }

    const presence = this.userPresences.get(payload.userId);
    if (presence) {
      presence.username = payload.username;
      if (payload.avatar !== undefined) {
        presence.avatar = payload.avatar || undefined;
      }
      this.server.emit('packet', {
        op: GatewayOpcode.DISPATCH,
        t: 'PRESENCE_UPDATE',
        d: presence,
      });
    }

    this.server.emit('packet', {
      op: GatewayOpcode.DISPATCH,
      t: 'USER_UPDATE',
      d: {
        userId: payload.userId,
        username: payload.username,
        avatar: payload.avatar,
      },
    });

    return { status: 'ok' };
  }

  /**
   * Broadcasts a Discord Gateway Dispatch event to a specific channel.
   */
  broadcastToChannel(channelId: string, eventName: string, data: unknown) {
    this.server.to(`channel:${channelId}`).emit('packet', {
      op: GatewayOpcode.DISPATCH,
      t: eventName,
      d: data,
    });
  }
}
