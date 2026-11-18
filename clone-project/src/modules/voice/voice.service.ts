import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import * as mediasoup from 'mediasoup';
import {
  Worker,
  Router,
  WebRtcTransport,
  Producer,
  Consumer,
  RtpCapabilities,
  RtpParameters,
  DtlsParameters,
  MediaKind,
} from 'mediasoup/node/lib/types';
import {
  MEDIA_CODECS,
  VoiceRoom,
  VoicePeer,
  SfuTransportParams,
  SfuProducerInfo,
} from './voice.types';

@Injectable()
export class VoiceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VoiceService.name);
  private worker: Worker | null = null;
  private readonly rooms = new Map<string, VoiceRoom>();

  async onModuleInit() {
    await this.initWorker();
  }

  async onModuleDestroy() {
    for (const room of this.rooms.values()) {
      room.router.close();
    }
    this.rooms.clear();
    if (this.worker) {
      this.worker.close();
      this.worker = null;
    }
  }

  private async initWorker() {
    try {
      this.worker = await mediasoup.createWorker({
        logLevel: 'warn',
        rtcMinPort: 20000,
        rtcMaxPort: 29999,
      });

      this.worker.on('died', () => {
        this.logger.error('Mediasoup Worker died unexpectedly! Spawning a new worker...');
        setTimeout(() => this.initWorker(), 2000);
      });

      this.logger.log(`🎙️ Mediasoup SFU Worker initialized successfully (PID: ${this.worker.pid})`);
    } catch (err) {
      this.logger.error('Failed to create Mediasoup SFU Worker:', err);
    }
  }

  public async getOrCreateRoom(channelId: string): Promise<VoiceRoom> {
    let room = this.rooms.get(channelId);
    if (!room) {
      if (!this.worker) {
        await this.initWorker();
      }
      if (!this.worker) {
        throw new BadRequestException('Mediasoup SFU Worker is not available.');
      }
      const router: Router = await this.worker.createRouter({
        mediaCodecs: MEDIA_CODECS,
      });
      room = {
        channelId,
        router,
        peers: new Map<string, VoicePeer>(),
      };
      this.rooms.set(channelId, room);
      this.logger.log(`Room router created for voice channel ${channelId}`);
    }
    return room;
  }

  public async getRouterRtpCapabilities(channelId: string): Promise<RtpCapabilities> {
    const room = await this.getOrCreateRoom(channelId);
    return room.router.rtpCapabilities;
  }

  public async createWebRtcTransport(
    channelId: string,
    peerId: string,
    userId: string,
    direction: 'send' | 'recv',
  ): Promise<SfuTransportParams> {
    const room = await this.getOrCreateRoom(channelId);
    let peer = room.peers.get(peerId);
    if (!peer) {
      peer = {
        id: peerId,
        userId,
        transports: new Map<string, WebRtcTransport>(),
        producers: new Map<string, Producer>(),
        consumers: new Map<string, Consumer>(),
      };
      room.peers.set(peerId, peer);
    }

    const announcedIp = process.env.MEDIASOUP_ANNOUNCED_IP || process.env.ANNOUNCED_IP || '127.0.0.1';
    const transport = await room.router.createWebRtcTransport({
      listenIps: [{ ip: '0.0.0.0', announcedIp }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 1000000,
      appData: { peerId, direction, userId },
    });

    peer.transports.set(transport.id, transport);

    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        transport.close();
      }
    });

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  public async connectTransport(
    channelId: string,
    peerId: string,
    transportId: string,
    dtlsParameters: DtlsParameters,
  ): Promise<void> {
    const room = this.rooms.get(channelId);
    const peer = room?.peers.get(peerId);
    const transport = peer?.transports.get(transportId);
    if (!transport) {
      throw new BadRequestException(`Transport ${transportId} not found.`);
    }
    await transport.connect({ dtlsParameters });
  }

  public async produce(
    channelId: string,
    peerId: string,
    transportId: string,
    kind: MediaKind,
    rtpParameters: RtpParameters,
    appData: Record<string, unknown> = {},
  ): Promise<{ id: string }> {
    const room = this.rooms.get(channelId);
    const peer = room?.peers.get(peerId);
    if (!peer) {
      throw new BadRequestException(`Peer ${peerId} not found in voice room.`);
    }
    const transport = peer.transports.get(transportId);
    if (!transport) {
      throw new BadRequestException(`Transport ${transportId} not found.`);
    }

    const producer = await transport.produce({
      kind,
      rtpParameters,
      appData: { ...appData, peerId, userId: peer.userId },
    });

    peer.producers.set(producer.id, producer);

    producer.on('transportclose', () => {
      producer.close();
      peer.producers.delete(producer.id);
    });

    return { id: producer.id };
  }

  public async consume(
    channelId: string,
    consumerPeerId: string,
    producerId: string,
    rtpCapabilities: RtpCapabilities,
  ): Promise<{
    id: string;
    producerId: string;
    kind: MediaKind;
    rtpParameters: RtpParameters;
  }> {
    const room = this.rooms.get(channelId);
    if (!room) {
      throw new BadRequestException(`Room ${channelId} not found.`);
    }

    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      throw new BadRequestException('Cannot consume track with given capabilities.');
    }

    const consumerPeer = room.peers.get(consumerPeerId);
    const recvTransport = Array.from(consumerPeer?.transports.values() || []).find(
      (t) => (t.appData as { direction?: string })?.direction === 'recv',
    );

    if (!recvTransport) {
      throw new BadRequestException('Receiver transport not found for peer.');
    }

    const consumer = await recvTransport.consume({
      producerId,
      rtpCapabilities,
      paused: true, // Recommended to start paused then resume
    });

    consumerPeer?.consumers.set(consumer.id, consumer);

    consumer.on('transportclose', () => {
      consumer.close();
      consumerPeer?.consumers.delete(consumer.id);
    });

    consumer.on('producerclose', () => {
      consumer.close();
      consumerPeer?.consumers.delete(consumer.id);
    });

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  public async resumeConsumer(channelId: string, peerId: string, consumerId: string): Promise<void> {
    const room = this.rooms.get(channelId);
    const peer = room?.peers.get(peerId);
    const consumer = peer?.consumers.get(consumerId);
    if (consumer) {
      await consumer.resume();
    }
  }

  public closePeer(channelId: string, peerId: string): void {
    const room = this.rooms.get(channelId);
    if (!room) return;
    const peer = room.peers.get(peerId);
    if (!peer) return;

    for (const producer of peer.producers.values()) {
      producer.close();
    }
    for (const consumer of peer.consumers.values()) {
      consumer.close();
    }
    for (const transport of peer.transports.values()) {
      transport.close();
    }

    room.peers.delete(peerId);
    if (room.peers.size === 0) {
      room.router.close();
      this.rooms.delete(channelId);
      this.logger.log(`Room router closed for empty voice channel ${channelId}`);
    }
  }

  public getChannelProducers(channelId: string): SfuProducerInfo[] {
    const room = this.rooms.get(channelId);
    if (!room) return [];

    const list: SfuProducerInfo[] = [];
    for (const peer of room.peers.values()) {
      for (const producer of peer.producers.values()) {
        list.push({
          producerId: producer.id,
          peerId: peer.id,
          userId: peer.userId,
          kind: producer.kind,
          appData: producer.appData as Record<string, unknown>,
        });
      }
    }
    return list;
  }
}
