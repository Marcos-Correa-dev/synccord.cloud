import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Inject,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/adapters/out/jwt-auth.guard';
import { CreateRoleDto } from '../dtos/create-role.dto';
import { RoleResponseDto } from '../dtos/role-response.dto';
import { SetChannelOverwriteDto, ChannelOverwriteResponseDto } from '../dtos/channel-overwrite.dto';
import { CreateRoleUseCase, CREATE_ROLE_USE_CASE } from '@modules/roles/application/ports/in/create-role.use-case';
import { ListGuildRolesUseCase, LIST_GUILD_ROLES_USE_CASE } from '@modules/roles/application/ports/in/list-guild-roles.use-case';
import { AssignRoleUseCase, ASSIGN_ROLE_USE_CASE } from '@modules/roles/application/ports/in/assign-role.use-case';
import {
  ManageChannelOverwritesUseCase,
  MANAGE_CHANNEL_OVERWRITES_USE_CASE,
} from '@modules/roles/application/ports/in/manage-channel-overwrites.use-case';
import { RoleRepositoryPort, ROLE_REPOSITORY_PORT } from '@modules/roles/application/ports/out/role-repository.port';

@ApiTags('Roles & Permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class RolesController {
  constructor(
    @Inject(CREATE_ROLE_USE_CASE)
    private readonly createRoleUseCase: CreateRoleUseCase,
    @Inject(LIST_GUILD_ROLES_USE_CASE)
    private readonly listGuildRolesUseCase: ListGuildRolesUseCase,
    @Inject(ASSIGN_ROLE_USE_CASE)
    private readonly assignRoleUseCase: AssignRoleUseCase,
    @Inject(MANAGE_CHANNEL_OVERWRITES_USE_CASE)
    private readonly manageOverwritesUseCase: ManageChannelOverwritesUseCase,
    @Inject(ROLE_REPOSITORY_PORT)
    private readonly roleRepo: RoleRepositoryPort,
  ) {}

  @Post('guilds/:guildId/roles')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new role in a guild' })
  @ApiParam({ name: 'guildId', description: 'Snowflake ID of the guild' })
  @ApiResponse({ status: 201, description: 'Role created successfully', type: RoleResponseDto })
  async createRole(
    @Param('guildId') guildId: string,
    @Body() dto: CreateRoleDto,
  ): Promise<RoleResponseDto> {
    return this.createRoleUseCase.execute({
      ...dto,
      guildId,
    });
  }

  @Get('guilds/:guildId/roles')
  @ApiOperation({ summary: 'List all roles in a guild' })
  @ApiParam({ name: 'guildId', description: 'Snowflake ID of the guild' })
  @ApiResponse({ status: 200, description: 'List of guild roles', type: [RoleResponseDto] })
  async listRoles(@Param('guildId') guildId: string): Promise<RoleResponseDto[]> {
    return this.listGuildRolesUseCase.execute(guildId);
  }

  @Get('guilds/:guildId/members/:userId/roles')
  @ApiOperation({ summary: 'Get list of role IDs assigned to a member' })
  @ApiParam({ name: 'guildId', description: 'Snowflake ID of the guild' })
  @ApiParam({ name: 'userId', description: 'Snowflake ID of the member' })
  @ApiResponse({ status: 200, description: 'List of role IDs assigned to member' })
  async getMemberRoles(
    @Param('guildId') guildId: string,
    @Param('userId') userId: string,
  ): Promise<string[]> {
    return this.roleRepo.getMemberRoleIds(guildId, userId);
  }

  @Post('guilds/:guildId/members/:userId/roles/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Add a role to a guild member' })
  async addRoleToMember(
    @Param('guildId') guildId: string,
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ): Promise<void> {
    await this.assignRoleUseCase.assignRole({ guildId, userId, roleId });
  }

  @Delete('guilds/:guildId/members/:userId/roles/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a role from a guild member' })
  async removeRoleFromMember(
    @Param('guildId') guildId: string,
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ): Promise<void> {
    await this.assignRoleUseCase.removeRole({ guildId, userId, roleId });
  }

  @Put('channels/:channelId/permissions/:targetId')
  @ApiOperation({ summary: 'Set channel permission overwrite for role or member' })
  @ApiResponse({ status: 200, type: ChannelOverwriteResponseDto })
  async setChannelOverwrite(
    @Param('channelId') channelId: string,
    @Param('targetId') targetId: string,
    @Body() dto: SetChannelOverwriteDto,
  ): Promise<ChannelOverwriteResponseDto> {
    return this.manageOverwritesUseCase.setOverwrite({
      channelId,
      targetId,
      type: dto.type,
      allow: dto.allow,
      deny: dto.deny,
    });
  }

  @Get('channels/:channelId/permissions')
  @ApiOperation({ summary: 'List channel permission overwrites' })
  @ApiResponse({ status: 200, type: [ChannelOverwriteResponseDto] })
  async listChannelOverwrites(
    @Param('channelId') channelId: string,
  ): Promise<ChannelOverwriteResponseDto[]> {
    return this.manageOverwritesUseCase.listOverwrites(channelId);
  }

  @Delete('channels/:channelId/permissions/:targetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete channel permission overwrite' })
  async deleteChannelOverwrite(
    @Param('channelId') channelId: string,
    @Param('targetId') targetId: string,
  ): Promise<void> {
    await this.manageOverwritesUseCase.deleteOverwrite(channelId, targetId);
  }
}
