import { Module } from '@nestjs/common';
import { GuildsController } from './infrastructure/adapters/in/controllers/guilds.controller';
import { CreateGuildService } from './application/use-cases/create-guild.service';
import { ListUserGuildsService } from './application/use-cases/list-user-guilds.service';
import { ListGuildMembersService } from './application/use-cases/list-guild-members.service';
import { JoinGuildService } from './application/use-cases/join-guild.service';
import { CREATE_GUILD_USE_CASE } from './application/ports/in/create-guild.use-case';
import { LIST_USER_GUILDS_USE_CASE } from './application/ports/in/list-user-guilds.use-case';
import { LIST_GUILD_MEMBERS_USE_CASE } from './application/ports/in/list-guild-members.use-case';
import { JOIN_GUILD_USE_CASE } from './application/ports/in/join-guild.use-case';
import { GUILD_REPOSITORY_PORT } from './application/ports/out/guild-repository.port';
import { DrizzleGuildRepository } from './infrastructure/adapters/out/persistence/drizzle-guild.repository';
import { AuthModule } from '@modules/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [GuildsController],
  providers: [
    {
      provide: CREATE_GUILD_USE_CASE,
      useClass: CreateGuildService,
    },
    {
      provide: LIST_USER_GUILDS_USE_CASE,
      useClass: ListUserGuildsService,
    },
    {
      provide: LIST_GUILD_MEMBERS_USE_CASE,
      useClass: ListGuildMembersService,
    },
    {
      provide: JOIN_GUILD_USE_CASE,
      useClass: JoinGuildService,
    },
    {
      provide: GUILD_REPOSITORY_PORT,
      useClass: DrizzleGuildRepository,
    },
  ],
  exports: [GUILD_REPOSITORY_PORT, CREATE_GUILD_USE_CASE],
})
export class GuildsModule {}
