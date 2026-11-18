import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/adapters/out/jwt-auth.guard';
import { VoiceService } from './voice.service';

@ApiTags('Voice & SFU')
@Controller('voice')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Get('regions')
  @ApiOperation({ summary: 'List available voice server regions' })
  @ApiResponse({ status: 200, description: 'List of optimal voice regions' })
  getVoiceRegions() {
    return [
      {
        id: 'brazil-vps-primary',
        name: 'Brasil (VPS Nativa / São Paulo)',
        custom: true,
        deprecated: false,
        optimal: true,
        vip: false,
      },
      {
        id: 'us-east',
        name: 'US East (Fallback)',
        custom: false,
        deprecated: false,
        optimal: false,
        vip: false,
      },
    ];
  }

  @Get('channels/:channelId/capabilities')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Mediasoup SFU router RTP capabilities for a channel' })
  @ApiParam({ name: 'channelId', description: 'Snowflake ID of the voice channel' })
  async getChannelCapabilities(@Param('channelId') channelId: string) {
    const rtpCapabilities = await this.voiceService.getRouterRtpCapabilities(channelId);
    return { channelId, rtpCapabilities };
  }
}
