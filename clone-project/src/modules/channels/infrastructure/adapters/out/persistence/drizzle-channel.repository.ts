import { Injectable, Inject } from '@nestjs/common';
import { eq, asc } from 'drizzle-orm';
import { Channel } from '@modules/channels/domain/entities/channel.entity';
import { ChannelRepositoryPort } from '@modules/channels/application/ports/out/channel-repository.port';
import { DRIZZLE_DB, AppDatabase } from '@infrastructure/database/database.module';
import { channelsTable } from '@infrastructure/database/schema';

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
