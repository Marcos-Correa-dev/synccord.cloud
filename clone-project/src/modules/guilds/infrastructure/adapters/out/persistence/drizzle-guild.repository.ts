import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { Guild } from '@modules/guilds/domain/entities/guild.entity';
import { GuildRepositoryPort, GuildMemberInfo } from '@modules/guilds/application/ports/out/guild-repository.port';
import { DRIZZLE_DB, AppDatabase } from '@infrastructure/database/database.module';
import { guildsTable, guildMembersTable, channelsTable, usersTable } from '@infrastructure/database/schema';
import { Snowflake } from '@shared/snowflake/snowflake';
import { ChannelType } from '@shared/constants/discord.constants';

@Injectable()
export class DrizzleGuildRepository implements GuildRepositoryPort {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: AppDatabase,
  ) {}

  async create(guild: Guild): Promise<Guild> {
    await this.db.insert(guildsTable).values({
      id: guild.id,
      name: guild.name,
      ownerId: guild.ownerId,
      icon: guild.icon,
      description: guild.description,
      createdAt: guild.createdAt,
      updatedAt: guild.updatedAt,
    });

    return guild;
  }

  async findById(id: string): Promise<Guild | null> {
    const result = await this.db
      .select()
      .from(guildsTable)
      .where(eq(guildsTable.id, id))
      .limit(1);

    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findUserGuilds(userId: string): Promise<Guild[]> {
    const members = await this.db
      .select({
        guild: guildsTable,
      })
      .from(guildMembersTable)
      .innerJoin(guildsTable, eq(guildMembersTable.guildId, guildsTable.id))
      .where(eq(guildMembersTable.userId, userId));

    return members.map((m) => this.mapToDomain(m.guild));
  }

  async addMember(guildId: string, userId: string, roles: string[] = []): Promise<void> {
    const alreadyMember = await this.isMember(guildId, userId);
    if (alreadyMember) return;

    await this.db.insert(guildMembersTable).values({
      guildId,
      userId,
      roles: JSON.stringify(roles),
      joinedAt: new Date(),
    });
  }

  async findGuildMembers(guildId: string): Promise<GuildMemberInfo[]> {
    const rows = await this.db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        discriminator: usersTable.discriminator,
        avatar: usersTable.avatar,
      })
      .from(guildMembersTable)
      .innerJoin(usersTable, eq(guildMembersTable.userId, usersTable.id))
      .where(eq(guildMembersTable.guildId, guildId));

    return rows;
  }

  async isMember(guildId: string, userId: string): Promise<boolean> {
    const rows = await this.db
      .select()
      .from(guildMembersTable)
      .where(and(eq(guildMembersTable.guildId, guildId), eq(guildMembersTable.userId, userId)))
      .limit(1);

    return rows.length > 0;
  }

  async createDefaultChannels(guildId: string): Promise<void> {
    // 1. Category "TEXT CHANNELS"
    const catId = Snowflake.generate();
    await this.db.insert(channelsTable).values({
      id: catId,
      guildId,
      name: 'TEXT CHANNELS',
      type: ChannelType.GUILD_CATEGORY,
      position: 0,
    });

    // 2. Text Channel "#geral"
    const textId = Snowflake.generate();
    await this.db.insert(channelsTable).values({
      id: textId,
      guildId,
      name: 'geral',
      type: ChannelType.GUILD_TEXT,
      parentId: catId,
      position: 0,
    });

    // 3. Voice Channel "Geral"
    const voiceId = Snowflake.generate();
    await this.db.insert(channelsTable).values({
      id: voiceId,
      guildId,
      name: 'Geral',
      type: ChannelType.GUILD_VOICE,
      parentId: catId,
      position: 1,
    });
  }

  private mapToDomain(row: typeof guildsTable.$inferSelect): Guild {
    return new Guild(
      row.id,
      row.name,
      row.ownerId,
      row.icon,
      row.description,
      row.createdAt,
      row.updatedAt,
    );
  }
}
