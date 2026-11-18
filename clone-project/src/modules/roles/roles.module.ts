import { Module, forwardRef } from '@nestjs/common';
import { RolesController } from './infrastructure/adapters/in/controllers/roles.controller';
import { CreateRoleService } from './application/use-cases/create-role.service';
import { ListGuildRolesService } from './application/use-cases/list-guild-roles.service';
import { AssignRoleService } from './application/use-cases/assign-role.service';
import { ManageChannelOverwritesService } from './application/use-cases/manage-channel-overwrites.service';
import { CREATE_ROLE_USE_CASE } from './application/ports/in/create-role.use-case';
import { LIST_GUILD_ROLES_USE_CASE } from './application/ports/in/list-guild-roles.use-case';
import { ASSIGN_ROLE_USE_CASE } from './application/ports/in/assign-role.use-case';
import { MANAGE_CHANNEL_OVERWRITES_USE_CASE } from './application/ports/in/manage-channel-overwrites.use-case';
import { ROLE_REPOSITORY_PORT } from './application/ports/out/role-repository.port';
import { DrizzleRoleRepository } from './infrastructure/adapters/out/persistence/drizzle-role.repository';
import { PermissionsGuard } from './infrastructure/adapters/out/permissions.guard';
import { GuildsModule } from '@modules/guilds/guilds.module';
import { ChannelsModule } from '@modules/channels/channels.module';

@Module({
  imports: [forwardRef(() => GuildsModule), forwardRef(() => ChannelsModule)],
  controllers: [RolesController],
  providers: [
    {
      provide: CREATE_ROLE_USE_CASE,
      useClass: CreateRoleService,
    },
    {
      provide: LIST_GUILD_ROLES_USE_CASE,
      useClass: ListGuildRolesService,
    },
    {
      provide: ASSIGN_ROLE_USE_CASE,
      useClass: AssignRoleService,
    },
    {
      provide: MANAGE_CHANNEL_OVERWRITES_USE_CASE,
      useClass: ManageChannelOverwritesService,
    },
    {
      provide: ROLE_REPOSITORY_PORT,
      useClass: DrizzleRoleRepository,
    },
    PermissionsGuard,
  ],
  exports: [ROLE_REPOSITORY_PORT, PermissionsGuard],
})
export class RolesModule {}
