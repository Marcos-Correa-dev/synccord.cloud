import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS_KEY } from './permissions.decorator';
import { PermissionCalculator } from '@modules/roles/domain/services/permission-calculator';
import { RoleRepositoryPort, ROLE_REPOSITORY_PORT } from '@modules/roles/application/ports/out/role-repository.port';
import { GuildRepositoryPort, GUILD_REPOSITORY_PORT } from '@modules/guilds/application/ports/out/guild-repository.port';
import { ChannelRepositoryPort, CHANNEL_REPOSITORY_PORT } from '@modules/channels/application/ports/out/channel-repository.port';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ROLE_REPOSITORY_PORT)
    private readonly roleRepo: RoleRepositoryPort,
    @Inject(GUILD_REPOSITORY_PORT)
    private readonly guildRepo: GuildRepositoryPort,
    @Inject(CHANNEL_REPOSITORY_PORT)
    private readonly channelRepo: ChannelRepositoryPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<bigint[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Usuário não autenticado.');
    }

    let guildId = request.params.guildId;
    const channelId = request.params.channelId;

    if (!guildId && channelId) {
      const channel = await this.channelRepo.findById(channelId);
      if (channel && channel.guildId) {
        guildId = channel.guildId;
      }
    }

    if (!guildId) {
      return true;
    }

    const guild = await this.guildRepo.findById(guildId);
    if (!guild) {
      throw new ForbiddenException('Servidor não encontrado.');
    }

    const guildRoles = await this.roleRepo.findByGuildId(guildId);
    const memberRoleIds = await this.roleRepo.getMemberRoleIds(guildId, user.id);
    const channelOverwrites = channelId
      ? await this.roleRepo.findChannelOverwrites(channelId)
      : [];

    const computed = PermissionCalculator.compute({
      userId: user.id,
      guildId,
      guildOwnerId: guild.ownerId,
      memberRoleIds,
      guildRoles,
      channelOverwrites,
    });

    for (const perm of requiredPermissions) {
      if (!PermissionCalculator.has(computed, perm)) {
        throw new ForbiddenException(
          'Você não possui as permissões necessárias para realizar esta ação.',
        );
      }
    }

    return true;
  }
}
