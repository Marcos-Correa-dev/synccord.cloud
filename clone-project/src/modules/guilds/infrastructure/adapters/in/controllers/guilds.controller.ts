import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Inject,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/adapters/out/jwt-auth.guard';
import { CreateGuildDto } from '../dtos/create-guild.dto';
import { GuildResponseDto } from '../dtos/guild-response.dto';
import { CreateGuildUseCase, CREATE_GUILD_USE_CASE } from '@modules/guilds/application/ports/in/create-guild.use-case';
import { ListUserGuildsUseCase, LIST_USER_GUILDS_USE_CASE } from '@modules/guilds/application/ports/in/list-user-guilds.use-case';
import { ListGuildMembersUseCase, LIST_GUILD_MEMBERS_USE_CASE } from '@modules/guilds/application/ports/in/list-guild-members.use-case';
import { JoinGuildUseCase, JOIN_GUILD_USE_CASE } from '@modules/guilds/application/ports/in/join-guild.use-case';
import { GuildRepositoryPort, GUILD_REPOSITORY_PORT, GuildMemberInfo } from '@modules/guilds/application/ports/out/guild-repository.port';
import { DiscordGateway } from '@modules/gateway/discord.gateway';
import { GatewayOpcode } from '@shared/constants/discord.constants';
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
    @Inject(GUILD_REPOSITORY_PORT)
    private readonly guildRepo: GuildRepositoryPort,
    private readonly gateway: DiscordGateway,
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

  @Get('discover')
  @ApiOperation({ summary: 'Discover community servers or search' })
  @ApiResponse({ status: 200, description: 'List of public/community servers', type: [GuildResponseDto] })
  async discoverGuilds(@Query('q') q?: string): Promise<GuildResponseDto[]> {
    const guilds = q ? await this.guildRepo.searchGuilds(q) : await this.guildRepo.findPublicGuilds();
    return guilds.map((g) => ({
      id: g.id,
      name: g.name,
      ownerId: g.ownerId,
      icon: g.icon,
      description: g.description,
      createdAt: g.createdAt,
    }));
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

  @Delete(':guildId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a server (guild) — Only allowed for the server owner' })
  @ApiParam({ name: 'guildId', description: 'Snowflake ID of the guild to delete' })
  async deleteGuild(
    @Param('guildId') guildId: string,
    @Request() req: { user: User },
  ): Promise<{ deleted: boolean; id: string }> {
    const guild = await this.guildRepo.findById(guildId);
    if (!guild) {
      throw new NotFoundException('Servidor não encontrado.');
    }
    if (guild.ownerId !== req.user.id) {
      throw new ForbiddenException('Apenas o criador (dono) do servidor pode excluí-lo.');
    }

    await this.guildRepo.delete(guildId);
    if (this.gateway?.server) {
      this.gateway.server.emit('packet', {
        op: GatewayOpcode.DISPATCH,
        t: 'GUILD_DELETE',
        d: { id: guildId },
      });
    }
    return { deleted: true, id: guildId };
  }

  @Delete(':guildId/members/@me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Leave a server (guild) — Only for invited members (non-owners)' })
  @ApiParam({ name: 'guildId', description: 'Snowflake ID of the guild to leave' })
  async leaveGuild(
    @Param('guildId') guildId: string,
    @Request() req: { user: User },
  ): Promise<{ left: boolean; guildId: string }> {
    const guild = await this.guildRepo.findById(guildId);
    if (!guild) {
      throw new NotFoundException('Servidor não encontrado.');
    }
    if (guild.ownerId === req.user.id) {
      throw new BadRequestException('O criador do servidor não pode sair dele; utilize a opção Excluir Servidor.');
    }

    await this.guildRepo.removeMember(guildId, req.user.id);
    return { left: true, guildId };
  }
}
