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
import {
  GatewayStateService,
  GatewayVoiceState,
  GatewayVoiceUser,
  UserPresence,
} from './gateway-state.service';

export { GatewayVoiceUser, UserPresence, GatewayVoiceState };

@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class DiscordGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  public server: Server;

  private readonly logger = new Logger(DiscordGateway.name);

  constructor(private readonly stateService: GatewayStateService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to Gateway: ${client.id}`);

    client.emit('packet', {
      op: GatewayOpcode.HELLO,
      d: { heartbeat_interval: 41250 },
    });

    client.emit('packet', {
      op: GatewayOpcode.DISPATCH,
      t: 'VOICE_STATES_SYNC',
      d: this.stateService.getAllVoiceStates(),
    });

    client.emit('packet', {
      op: GatewayOpcode.DISPATCH,
      t: 'PRESENCES_SYNC',
      d: this.stateService.getAllPresences(),
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from Gateway: ${client.id}`);

    const removed = this.stateService.removeVoiceStatesBySocketId(client.id);
    for (const state of removed) {
      this.server.emit('packet', {
        op: GatewayOpcode.DISPATCH,
        t: 'VOICE_STATE_UPDATE',
        d: {
          guildId: state.guildId,
          channelId: null,
          userId: state.user.id,
        },
      });
    }
  }

  @SubscribeMessage('heartbeat')
  handleHeartbeat(client: Socket, _payload: unknown) {
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
    const existing = this.stateService.getVoiceState(userId);
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

    this.stateService.setVoiceState(userId, state);
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
    const state = this.stateService.removeVoiceState(userId);
    if (state && state.channelId) {
      client.leave(`voice:${state.channelId}`);
      client.leave(`channel:${state.channelId}`);
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
    const updated = this.stateService.updateSpeaking(String(payload.userId), payload.speaking);
    if (updated) {
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
    const updated = this.stateService.updateStream(userId, payload);
    if (updated) {
      this.server.emit('packet', {
        op: GatewayOpcode.DISPATCH,
        t: 'VOICE_STREAM_UPDATE',
        d: {
          channelId: payload.channelId,
          userId,
          username: payload.username || updated.user.username,
          streaming: updated.streaming ?? false,
          video: updated.video ?? false,
          screenTrackId: updated.screenTrackId ?? null,
          cameraTrackId: updated.cameraTrackId ?? null,
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
      const targetState = this.stateService.getVoiceState(String(payload.to));
      if (targetState?.socketId) {
        this.server.to(targetState.socketId).emit('packet', {
          op: GatewayOpcode.DISPATCH,
          t: 'VOICE_SIGNAL',
          d: payload,
        });
        return;
      }
    }

    const room = payload.channelId ? `voice:${payload.channelId}` : null;
    if (room) {
      this.server.to(room).emit('packet', {
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
  handlePresenceUpdate(_client: Socket, payload: UserPresence) {
    this.stateService.setPresence(payload.userId, payload);
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
      d: this.stateService.getAllPresences(),
    });
  }

  @SubscribeMessage('voice:get_states')
  handleGetVoiceStates(client: Socket) {
    client.emit('packet', {
      op: GatewayOpcode.DISPATCH,
      t: 'VOICE_STATES_SYNC',
      d: this.stateService.getAllVoiceStates(),
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
    const { state, presence } = this.stateService.updateUserProfile(
      payload.userId,
      payload.username,
      payload.avatar,
    );

    if (state) {
      this.server.emit('packet', {
        op: GatewayOpcode.DISPATCH,
        t: 'VOICE_STATE_UPDATE',
        d: state,
      });
    }

    if (presence) {
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

  broadcastToChannel(channelId: string, eventName: string, data: unknown) {
    this.server.to(`channel:${channelId}`).emit('packet', {
      op: GatewayOpcode.DISPATCH,
      t: eventName,
      d: data,
    });
  }
}
