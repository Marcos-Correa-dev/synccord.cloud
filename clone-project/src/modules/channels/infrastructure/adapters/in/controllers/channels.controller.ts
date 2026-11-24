import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Inject,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/adapters/out/jwt-auth.guard';
import { CreateChannelDto } from '../dtos/create-channel.dto';
import { UpdateChannelDto } from '../dtos/update-channel.dto';
import { ChannelResponseDto } from '../dtos/channel-response.dto';
import { CreateChannelUseCase, CREATE_CHANNEL_USE_CASE } from '@modules/channels/application/ports/in/create-channel.use-case';
import { ListGuildChannelsUseCase, LIST_GUILD_CHANNELS_USE_CASE } from '@modules/channels/application/ports/in/list-guild-channels.use-case';
import { UpdateChannelUseCase, UPDATE_CHANNEL_USE_CASE } from '@modules/channels/application/ports/in/update-channel.use-case';
import { DeleteChannelUseCase, DELETE_CHANNEL_USE_CASE } from '@modules/channels/application/ports/in/delete-channel.use-case';
import {
  ChannelRepositoryPort,
  CHANNEL_REPOSITORY_PORT,
  DmChannelSummary,
  MutualContact,
} from '@modules/channels/application/ports/out/channel-repository.port';
import { DiscordGateway } from '@modules/gateway/discord.gateway';
import { GatewayOpcode } from '@shared/constants/discord.constants';
import { User } from '@modules/auth/domain/user.entity';

@ApiTags('Channels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ChannelsController {
  constructor(
    @Inject(CREATE_CHANNEL_USE_CASE)
    private readonly createChannelUseCase: CreateChannelUseCase,
    @Inject(LIST_GUILD_CHANNELS_USE_CASE)
    private readonly listGuildChannelsUseCase: ListGuildChannelsUseCase,
    @Inject(UPDATE_CHANNEL_USE_CASE)
    private readonly updateChannelUseCase: UpdateChannelUseCase,
    @Inject(DELETE_CHANNEL_USE_CASE)
    private readonly deleteChannelUseCase: DeleteChannelUseCase,
    @Inject(CHANNEL_REPOSITORY_PORT)
    private readonly channelRepo: ChannelRepositoryPort,
    private readonly gateway: DiscordGateway,
  ) {}

  @Post('guilds/:guildId/channels')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new channel in a guild' })
  @ApiParam({ name: 'guildId', description: 'Snowflake ID of the guild' })
  @ApiResponse({ status: 201, description: 'Channel created successfully', type: ChannelResponseDto })
  async createChannel(
    @Param('guildId') guildId: string,
    @Body() dto: CreateChannelDto,
  ): Promise<ChannelResponseDto> {
    const created = await this.createChannelUseCase.execute({
      ...dto,
      guildId,
    });
    if (this.gateway?.server) {
      this.gateway.server.emit('packet', {
        op: GatewayOpcode.DISPATCH,
        t: 'CHANNEL_CREATE',
        d: created,
      });
    }
    return created;
  }

  @Get('guilds/:guildId/channels')
  @ApiOperation({ summary: 'List all channels in a guild' })
  @ApiParam({ name: 'guildId', description: 'Snowflake ID of the guild' })
  @ApiResponse({ status: 200, description: 'List of guild channels', type: [ChannelResponseDto] })
  async listGuildChannels(
    @Param('guildId') guildId: string,
  ): Promise<ChannelResponseDto[]> {
    return this.listGuildChannelsUseCase.execute(guildId);
  }

  @Patch('channels/:channelId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update/rename a text or voice channel' })
  @ApiParam({ name: 'channelId', description: 'Snowflake ID of the channel' })
  @ApiResponse({ status: 200, description: 'Channel updated successfully', type: ChannelResponseDto })
  async updateChannel(
    @Param('channelId') channelId: string,
    @Body() dto: UpdateChannelDto,
  ): Promise<ChannelResponseDto> {
    const updated = await this.updateChannelUseCase.execute({
      channelId,
      name: dto.name,
      topic: dto.topic,
    });
    if (this.gateway?.server) {
      this.gateway.server.emit('packet', {
        op: GatewayOpcode.DISPATCH,
        t: 'CHANNEL_UPDATE',
        d: updated,
      });
    }
    return updated;
  }

  @Delete('channels/:channelId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a text or voice channel' })
  @ApiParam({ name: 'channelId', description: 'Snowflake ID of the channel' })
  @ApiResponse({ status: 200, description: 'Channel deleted successfully' })
  async deleteChannel(
    @Param('channelId') channelId: string,
  ): Promise<{ deleted: boolean; id: string; guildId: string | null }> {
    const result = await this.deleteChannelUseCase.execute(channelId);
    if (this.gateway?.server) {
      this.gateway.server.emit('packet', {
        op: GatewayOpcode.DISPATCH,
        t: 'CHANNEL_DELETE',
        d: result,
      });
    }
    return result;
  }

  @Get('users/@me/channels')
  @ApiOperation({ summary: 'List all Direct Message (DM) channels for current user' })
  async listMyDmChannels(@Request() req: { user: User }): Promise<DmChannelSummary[]> {
    return this.channelRepo.findUserDmChannels(req.user.id);
  }

  @Post('users/@me/channels')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Open or create a Direct Message (DM) channel with a friend/user' })
  async openDmChannel(
    @Request() req: { user: User },
    @Body() body: { recipientId?: string; recipient_id?: string },
  ): Promise<DmChannelSummary> {
    const targetId = (body?.recipientId || body?.recipient_id || '').trim();
    const dm = await this.channelRepo.findOrCreateDmChannel(req.user.id, targetId);
    if (this.gateway?.server) {
      this.gateway.server.emit('packet', {
        op: GatewayOpcode.DISPATCH,
        t: 'DM_CHANNEL_CREATE',
        d: {
          channelId: dm.id,
          participants: [req.user.id, targetId],
          dm,
        },
      });
    }
    return dm;
  }

  @Get('users/@me/friends')
  @ApiOperation({ summary: 'List mutual contacts/friends across servers for Direct Messaging' })
  async listMutualContacts(@Request() req: { user: User }): Promise<MutualContact[]> {
    return this.channelRepo.findMutualContacts(req.user.id);
  }
}
