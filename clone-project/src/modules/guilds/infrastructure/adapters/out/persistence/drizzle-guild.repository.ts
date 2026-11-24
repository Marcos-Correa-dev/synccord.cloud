import { Injectable, Inject } from '@nestjs/common';
import { eq, and, ilike, inArray } from 'drizzle-orm';
import { Guild } from '@modules/guilds/domain/entities/guild.entity';
import { GuildRepositoryPort, GuildMemberInfo } from '@modules/guilds/application/ports/out/guild-repository.port';
import { DRIZZLE_DB, AppDatabase } from '@infrastructure/database/database.module';
import {
  guildsTable,
  guildMembersTable,
  channelsTable,
  usersTable,
  messagesTable,
  channelOverwritesTable,
  rolesTable,
} from '@infrastructure/database/schema';
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
    let result = await this.db
      .select()
      .from(guildsTable)
      .where(ilike(guildsTable.name, trimmed))
      .limit(1);

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
    const members = await this.db
      .select({
        guild: guildsTable,
      })
      .from(guildMembersTable)
      .innerJoin(guildsTable, eq(guildMembersTable.guildId, guildsTable.id))
      .where(eq(guildMembersTable.userId, userId));

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
      // Ignore concurrent insert conflict
    }
  }

  async removeMember(guildId: string, userId: string): Promise<void> {
    await this.db
      .delete(guildMembersTable)
      .where(and(eq(guildMembersTable.guildId, guildId), eq(guildMembersTable.userId, userId)));
  }

  async delete(guildId: string): Promise<void> {
    const channels = await this.db
      .select({ id: channelsTable.id })
      .from(channelsTable)
      .where(eq(channelsTable.guildId, guildId));

    const channelIds = channels.map((c) => c.id);
    if (channelIds.length > 0) {
      await this.db.delete(messagesTable).where(inArray(messagesTable.channelId, channelIds));
      await this.db.delete(channelOverwritesTable).where(inArray(channelOverwritesTable.channelId, channelIds));
      await this.db.delete(channelsTable).where(eq(channelsTable.guildId, guildId));
    }

    await this.db.delete(rolesTable).where(eq(rolesTable.guildId, guildId));
    await this.db.delete(guildMembersTable).where(eq(guildMembersTable.guildId, guildId));
    await this.db.delete(guildsTable).where(eq(guildsTable.id, guildId));
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
    const catId = Snowflake.generate();
    await this.db.insert(channelsTable).values({
      id: catId,
      guildId,
      name: 'TEXT CHANNELS',
      type: ChannelType.GUILD_CATEGORY,
      position: 0,
    });

    const textId = Snowflake.generate();
    await this.db.insert(channelsTable).values({
      id: textId,
      guildId,
      name: 'geral',
      type: ChannelType.GUILD_TEXT,
      parentId: catId,
      position: 0,
    });

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
