import {
  RtpCodecCapability,
  WebRtcTransport,
  Producer,
  Consumer,
  Router,
} from 'mediasoup/node/lib/types';

/**
 * Standard Discord Audio/Video Media Codecs
 */
export const MEDIA_CODECS: RtpCodecCapability[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
    preferredPayloadType: 111,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    preferredPayloadType: 96,
  },
  {
    kind: 'video',
    mimeType: 'video/H264',
    clockRate: 90000,
    preferredPayloadType: 125,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '42e01f',
      'level-asymmetry-allowed': 1,
    },
  },
];

export interface VoicePeer {
  id: string; // Socket ID or User ID
  userId: string;
  transports: Map<string, WebRtcTransport>;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
}

export interface VoiceRoom {
  channelId: string;
  router: Router;
  peers: Map<string, VoicePeer>;
}

export interface SfuTransportParams {
  id: string;
  iceParameters: unknown;
  iceCandidates: unknown;
  dtlsParameters: unknown;
}

export interface SfuProducerInfo {
  producerId: string;
  peerId: string;
  userId: string;
  kind: 'audio' | 'video';
  appData?: Record<string, unknown>;
}
