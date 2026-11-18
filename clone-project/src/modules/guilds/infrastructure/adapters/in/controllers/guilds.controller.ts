import { Controller, Post, Get, Body, Param, UseGuards, Request, Inject, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/adapters/out/jwt-auth.guard';
import { CreateGuildDto } from '../dtos/create-guild.dto';
import { GuildResponseDto } from '../dtos/guild-response.dto';
import { CreateGuildUseCase, CREATE_GUILD_USE_CASE } from '@modules/guilds/application/ports/in/create-guild.use-case';
import { ListUserGuildsUseCase, LIST_USER_GUILDS_USE_CASE } from '@modules/guilds/application/ports/in/list-user-guilds.use-case';
import { ListGuildMembersUseCase, LIST_GUILD_MEMBERS_USE_CASE } from '@modules/guilds/application/ports/in/list-guild-members.use-case';
import { JoinGuildUseCase, JOIN_GUILD_USE_CASE } from '@modules/guilds/application/ports/in/join-guild.use-case';
import { GuildMemberInfo } from '@modules/guilds/application/ports/out/guild-repository.port';
import { User } from '@modules/auth/domain/user.entity';

@ApiTags('Guilds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('guilds')
export class GuildsController {
  constructor(
    @Inject(CREATE_GUILD_USE_CASE)
    private readonly createGuildUseCase: CreateGuildUseCase,
    @Inject(LIST_USER_GUILDS_USE_CASE)
    private readonly listUserGuildsUseCase: ListUserGuildsUseCase,
    @Inject(LIST_GUILD_MEMBERS_USE_CASE)
    private readonly listGuildMembersUseCase: ListGuildMembersUseCase,
    @Inject(JOIN_GUILD_USE_CASE)
    private readonly joinGuildUseCase: JoinGuildUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new server (guild)' })
  @ApiResponse({ status: 201, description: 'Guild created successfully', type: GuildResponseDto })
  async create(
    @Body() dto: CreateGuildDto,
    @Request() req: { user: User },
  ): Promise<GuildResponseDto> {
    return this.createGuildUseCase.execute({
      ...dto,
      ownerId: req.user.id,
    });
  }

  @Get('@me')
  @ApiOperation({ summary: 'List all guilds the current user belongs to' })
  @ApiResponse({ status: 200, description: 'List of user guilds', type: [GuildResponseDto] })
  async listUserGuilds(@Request() req: { user: User }): Promise<GuildResponseDto[]> {
    return this.listUserGuildsUseCase.execute(req.user.id);
  }

  @Get(':guildId/members')
  @ApiOperation({ summary: 'List all members of a guild' })
  @ApiParam({ name: 'guildId', description: 'Snowflake ID of the guild' })
  @ApiResponse({ status: 200, description: 'List of guild members' })
  async listGuildMembers(
    @Param('guildId') guildId: string,
  ): Promise<GuildMemberInfo[]> {
    return this.listGuildMembersUseCase.execute(guildId);
  }

  @Post(':guildId/members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join a server by guild ID / invite' })
  @ApiParam({ name: 'guildId', description: 'Snowflake ID of the guild to join' })
  @ApiResponse({ status: 200, description: 'Joined guild successfully', type: GuildResponseDto })
  async joinGuild(
    @Param('guildId') guildId: string,
    @Request() req: { user: User },
  ): Promise<GuildResponseDto> {
    const guild = await this.joinGuildUseCase.execute(guildId, req.user.id);
    return {
      id: guild.id,
      name: guild.name,
      ownerId: guild.ownerId,
      icon: guild.icon,
      description: guild.description,
      createdAt: guild.createdAt,
    };
  }
}
