import { Injectable, Inject } from '@nestjs/common';
import { eq, and, ilike } from 'drizzle-orm';
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

  async findByName(name: string): Promise<Guild | null> {
    const trimmed = decodeURIComponent(name).trim();
    // 1. Exact match (case-insensitive)
    let result = await this.db
      .select()
      .from(guildsTable)
      .where(ilike(guildsTable.name, trimmed))
      .limit(1);

    // 2. Partial match (case-insensitive)
    if (result.length === 0) {
      result = await this.db
        .select()
        .from(guildsTable)
        .where(ilike(guildsTable.name, `%${trimmed}%`))
        .limit(1);
    }

    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findPublicGuilds(): Promise<Guild[]> {
    const rows = await this.db
      .select()
      .from(guildsTable)
      .limit(50);

    return rows.map((r) => this.mapToDomain(r));
  }

  async searchGuilds(query: string): Promise<Guild[]> {
    const trimmed = decodeURIComponent(query).trim();
    const rows = await this.db
      .select()
      .from(guildsTable)
      .where(ilike(guildsTable.name, `%${trimmed}%`))
      .limit(20);

    return rows.map((r) => this.mapToDomain(r));
  }

  async findUserGuilds(userId: string): Promise<Guild[]> {
    // 1. Guilds where user is an accepted member
    const members = await this.db
      .select({
        guild: guildsTable,
      })
      .from(guildMembersTable)
      .innerJoin(guildsTable, eq(guildMembersTable.guildId, guildsTable.id))
      .where(eq(guildMembersTable.userId, userId));

    // 2. Guilds where user is the owner (prevents missing servers if member entry wasn't recorded)
    const owned = await this.db
      .select()
      .from(guildsTable)
      .where(eq(guildsTable.ownerId, userId));

    const map = new Map<string, Guild>();
    for (const m of members) {
      map.set(m.guild.id, this.mapToDomain(m.guild));
    }
    for (const g of owned) {
      if (!map.has(g.id)) {
        map.set(g.id, this.mapToDomain(g));
        // Auto-heal membership table for the owner
        this.addMember(g.id, userId, ['owner']).catch(() => {});
      }
    }

    return Array.from(map.values());
  }

  async addMember(guildId: string, userId: string, roles: string[] = []): Promise<void> {
    const alreadyMember = await this.isMember(guildId, userId);
    if (alreadyMember) return;

    try {
      await this.db.insert(guildMembersTable).values({
        guildId,
        userId,
        roles: JSON.stringify(roles),
        joinedAt: new Date(),
      });
    } catch {
      // In case of concurrent race condition or existing primary key, ignore cleanly
    }
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
