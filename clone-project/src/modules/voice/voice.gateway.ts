import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { VoiceService } from './voice.service';
import { DtlsParameters, MediaKind, RtpCapabilities, RtpParameters } from 'mediasoup/node/lib/types';

@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class VoiceGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  public server: Server;

  private readonly logger = new Logger(VoiceGateway.name);
  private readonly socketChannelMap = new Map<string, string>();

  constructor(private readonly voiceService: VoiceService) {}

  handleDisconnect(client: Socket) {
    const channelId = this.socketChannelMap.get(client.id);
    if (channelId) {
      this.voiceService.closePeer(channelId, client.id);
      this.socketChannelMap.delete(client.id);
      this.server.to(`voice:${channelId}`).emit('voice:sfu_peer_left', {
        channelId,
        peerId: client.id,
      });
    }
  }

  @SubscribeMessage('voice:sfu_capabilities')
  async handleGetCapabilities(
    _client: Socket,
    payload: { channelId: string },
  ) {
    const rtpCapabilities = await this.voiceService.getRouterRtpCapabilities(payload.channelId);
    return { rtpCapabilities };
  }

  @SubscribeMessage('voice:sfu_create_transport')
  async handleCreateTransport(
    client: Socket,
    payload: { channelId: string; userId: string; direction: 'send' | 'recv' },
  ) {
    this.socketChannelMap.set(client.id, payload.channelId);
    const transportParams = await this.voiceService.createWebRtcTransport(
      payload.channelId,
      client.id,
      payload.userId,
      payload.direction,
    );
    return transportParams;
  }

  @SubscribeMessage('voice:sfu_connect_transport')
  async handleConnectTransport(
    client: Socket,
    payload: { channelId: string; transportId: string; dtlsParameters: DtlsParameters },
  ) {
    await this.voiceService.connectTransport(
      payload.channelId,
      client.id,
      payload.transportId,
      payload.dtlsParameters,
    );
    return { connected: true };
  }

  @SubscribeMessage('voice:sfu_produce')
  async handleProduce(
    client: Socket,
    payload: {
      channelId: string;
      transportId: string;
      kind: MediaKind;
      rtpParameters: RtpParameters;
      appData?: Record<string, unknown>;
      userId: string;
    },
  ) {
    const result = await this.voiceService.produce(
      payload.channelId,
      client.id,
      payload.transportId,
      payload.kind,
      payload.rtpParameters,
      payload.appData,
    );

    // Notify other peers in this voice room so they consume the new stream
    client.to(`voice:${payload.channelId}`).emit('voice:sfu_new_producer', {
      channelId: payload.channelId,
      producerId: result.id,
      peerId: client.id,
      userId: payload.userId,
      kind: payload.kind,
      appData: payload.appData,
    });

    return result;
  }

  @SubscribeMessage('voice:sfu_consume')
  async handleConsume(
    client: Socket,
    payload: {
      channelId: string;
      producerId: string;
      rtpCapabilities: RtpCapabilities;
    },
  ) {
    const consumerParams = await this.voiceService.consume(
      payload.channelId,
      client.id,
      payload.producerId,
      payload.rtpCapabilities,
    );
    return consumerParams;
  }

  @SubscribeMessage('voice:sfu_resume_consumer')
  async handleResumeConsumer(
    client: Socket,
    payload: { channelId: string; consumerId: string },
  ) {
    await this.voiceService.resumeConsumer(
      payload.channelId,
      client.id,
      payload.consumerId,
    );
    return { resumed: true };
  }

  @SubscribeMessage('voice:sfu_get_producers')
  handleGetProducers(
    _client: Socket,
    payload: { channelId: string },
  ) {
    return this.voiceService.getChannelProducers(payload.channelId);
  }

  @SubscribeMessage('voice:sfu_leave')
  handleLeave(
    client: Socket,
    payload: { channelId: string },
  ) {
    this.voiceService.closePeer(payload.channelId, client.id);
    this.socketChannelMap.delete(client.id);
    client.to(`voice:${payload.channelId}`).emit('voice:sfu_peer_left', {
      channelId: payload.channelId,
      peerId: client.id,
    });
    return { left: true };
  }
}
