import { Controller, Post, Get, Body, Param, UseGuards, Inject, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/adapters/out/jwt-auth.guard';
import { CreateChannelDto } from '../dtos/create-channel.dto';
import { ChannelResponseDto } from '../dtos/channel-response.dto';
import { CreateChannelUseCase, CREATE_CHANNEL_USE_CASE } from '@modules/channels/application/ports/in/create-channel.use-case';
import { ListGuildChannelsUseCase, LIST_GUILD_CHANNELS_USE_CASE } from '@modules/channels/application/ports/in/list-guild-channels.use-case';

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
    return this.createChannelUseCase.execute({
      ...dto,
      guildId,
    });
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
}
