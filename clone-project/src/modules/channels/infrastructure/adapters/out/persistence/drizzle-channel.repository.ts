import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, asc, inArray } from 'drizzle-orm';
import { Channel } from '@modules/channels/domain/entities/channel.entity';
import {
  ChannelRepositoryPort,
  DmChannelSummary,
  MutualContact,
} from '@modules/channels/application/ports/out/channel-repository.port';
import { DRIZZLE_DB, AppDatabase } from '@infrastructure/database/database.module';
import {
  channelsTable,
  messagesTable,
  channelOverwritesTable,
  dmParticipantsTable,
  usersTable,
  guildMembersTable,
  guildsTable,
} from '@infrastructure/database/schema';
import { Snowflake } from '@shared/snowflake/snowflake';
import { ChannelType } from '@shared/constants/discord.constants';

@Injectable()
export class DrizzleChannelRepository implements ChannelRepositoryPort {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: AppDatabase,
  ) {}

  async create(channel: Channel): Promise<Channel> {
    await this.db.insert(channelsTable).values({
      id: channel.id,
      guildId: channel.guildId,
      name: channel.name,
      type: channel.type,
      topic: channel.topic,
      position: channel.position,
      parentId: channel.parentId,
      createdAt: channel.createdAt,
    });

    return channel;
  }

  async findById(id: string): Promise<Channel | null> {
    const result = await this.db
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.id, id))
      .limit(1);

    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByGuildId(guildId: string): Promise<Channel[]> {
    const rows = await this.db
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.guildId, guildId))
      .orderBy(asc(channelsTable.position));

    return rows.map((r) => this.mapToDomain(r));
  }

  async update(id: string, data: { name?: string; topic?: string | null }): Promise<Channel> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException('Canal não encontrado.');
    }

    const updatedName = data.name !== undefined ? data.name : existing.name;
    const updatedTopic = data.topic !== undefined ? data.topic : existing.topic;

    await this.db
      .update(channelsTable)
      .set({
        name: updatedName,
        topic: updatedTopic,
      })
      .where(eq(channelsTable.id, id));

    return new Channel(
      existing.id,
      existing.guildId,
      updatedName,
      existing.type,
      updatedTopic,
      existing.position,
      existing.parentId,
      existing.createdAt,
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(messagesTable).where(eq(messagesTable.channelId, id));
    await this.db.delete(channelOverwritesTable).where(eq(channelOverwritesTable.channelId, id));
    await this.db.delete(dmParticipantsTable).where(eq(dmParticipantsTable.channelId, id));
    await this.db.delete(channelsTable).where(eq(channelsTable.id, id));
  }

  async findOrCreateDmChannel(userId: string, recipientId: string): Promise<DmChannelSummary> {
    if (!recipientId || userId === recipientId) {
      throw new BadRequestException('Não é possível iniciar uma mensagem direta consigo mesmo.');
    }

    const recipientRows = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, recipientId))
      .limit(1);

    if (recipientRows.length === 0) {
      throw new NotFoundException('Destinatário não encontrado.');
    }
    const recipient = recipientRows[0];

    const existingDms = await this.findUserDmChannels(userId);
    const match = existingDms.find((dm) => dm.recipient.id === recipientId);
    if (match) {
      return match;
    }

    const dmChannelId = Snowflake.generate();
    const createdAt = new Date();
    await this.db.insert(channelsTable).values({
      id: dmChannelId,
      guildId: null,
      name: `dm-${userId}-${recipientId}`,
      type: ChannelType.DM,
      topic: null,
      position: 0,
      parentId: null,
      createdAt,
    });

    await this.db.insert(dmParticipantsTable).values([
      { channelId: dmChannelId, userId, createdAt },
      { channelId: dmChannelId, userId: recipientId, createdAt },
    ]);

    return {
      id: dmChannelId,
      type: ChannelType.DM,
      name: recipient.username,
      recipient: {
        id: recipient.id,
        username: recipient.username,
        discriminator: recipient.discriminator,
        avatar: recipient.avatar,
      },
      createdAt,
    };
  }

  async findUserDmChannels(userId: string): Promise<DmChannelSummary[]> {
    const myParticipations = await this.db
      .select()
      .from(dmParticipantsTable)
      .where(eq(dmParticipantsTable.userId, userId));

    if (myParticipations.length === 0) return [];

    const channelIds = myParticipations.map((p) => p.channelId);

    const allParticipants = await this.db
      .select({
        channelId: dmParticipantsTable.channelId,
        userId: dmParticipantsTable.userId,
        createdAt: dmParticipantsTable.createdAt,
        username: usersTable.username,
        discriminator: usersTable.discriminator,
        avatar: usersTable.avatar,
      })
      .from(dmParticipantsTable)
      .innerJoin(usersTable, eq(dmParticipantsTable.userId, usersTable.id))
      .where(inArray(dmParticipantsTable.channelId, channelIds));

    const summaries: DmChannelSummary[] = [];
    for (const chId of channelIds) {
      const other = allParticipants.find((p) => p.channelId === chId && p.userId !== userId);
      if (other) {
        summaries.push({
          id: chId,
          type: ChannelType.DM,
          name: other.username,
          recipient: {
            id: other.userId,
            username: other.username,
            discriminator: other.discriminator,
            avatar: other.avatar,
          },
          createdAt: other.createdAt,
        });
      }
    }

    return summaries;
  }

  async findMutualContacts(userId: string): Promise<MutualContact[]> {
    const myMemberships = await this.db
      .select({ guildId: guildMembersTable.guildId })
      .from(guildMembersTable)
      .where(eq(guildMembersTable.userId, userId));

    const ownedGuilds = await this.db
      .select({ id: guildsTable.id })
      .from(guildsTable)
      .where(eq(guildsTable.ownerId, userId));

    const guildIds = Array.from(
      new Set([...myMemberships.map((m) => m.guildId), ...ownedGuilds.map((g) => g.id)]),
    );

    if (guildIds.length === 0) return [];

    const rows = await this.db
      .select({
        userId: usersTable.id,
        username: usersTable.username,
        discriminator: usersTable.discriminator,
        avatar: usersTable.avatar,
        guildName: guildsTable.name,
      })
      .from(guildMembersTable)
      .innerJoin(usersTable, eq(guildMembersTable.userId, usersTable.id))
      .innerJoin(guildsTable, eq(guildMembersTable.guildId, guildsTable.id))
      .where(inArray(guildMembersTable.guildId, guildIds));

    const map = new Map<string, MutualContact>();
    for (const r of rows) {
      if (r.userId === userId) continue;
      let existing = map.get(r.userId);
      if (!existing) {
        existing = {
          id: r.userId,
          username: r.username,
          discriminator: r.discriminator,
          avatar: r.avatar,
          mutualGuildNames: [],
        };
        map.set(r.userId, existing);
      }
      if (!existing.mutualGuildNames.includes(r.guildName)) {
        existing.mutualGuildNames.push(r.guildName);
      }
    }

    return Array.from(map.values());
  }

  private mapToDomain(row: typeof channelsTable.$inferSelect): Channel {
    return new Channel(
      row.id,
      row.guildId,
      row.name,
      row.type,
      row.topic,
      row.position,
      row.parentId,
      row.createdAt,
    );
  }
}
