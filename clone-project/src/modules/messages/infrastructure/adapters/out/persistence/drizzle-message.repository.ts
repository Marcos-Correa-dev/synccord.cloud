import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, desc, and, lt } from 'drizzle-orm';
import { Message } from '@modules/messages/domain/entities/message.entity';
import { MessageRepositoryPort } from '@modules/messages/application/ports/out/message-repository.port';
import { DRIZZLE_DB, AppDatabase } from '@infrastructure/database/database.module';
import { messagesTable, usersTable } from '@infrastructure/database/schema';

interface MessageRowWithAuthor {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  pinned: boolean;
  editedAt: Date | null;
  createdAt: Date;
  authorName: string | null;
  authorDiscriminator: string | null;
  authorAvatar: string | null;
}

@Injectable()
export class DrizzleMessageRepository implements MessageRepositoryPort {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: AppDatabase,
  ) {}

  async create(message: Message): Promise<Message> {
    await this.db.insert(messagesTable).values({
      id: message.id,
      channelId: message.channelId,
      authorId: message.authorId,
      content: message.content,
      pinned: message.pinned,
      editedAt: message.editedAt,
      createdAt: message.createdAt,
    });

    return message;
  }

  async findById(id: string): Promise<Message | null> {
    const result = await this.db
      .select({
        id: messagesTable.id,
        channelId: messagesTable.channelId,
        authorId: messagesTable.authorId,
        content: messagesTable.content,
        pinned: messagesTable.pinned,
        editedAt: messagesTable.editedAt,
        createdAt: messagesTable.createdAt,
        authorName: usersTable.username,
        authorDiscriminator: usersTable.discriminator,
        authorAvatar: usersTable.avatar,
      })
      .from(messagesTable)
      .leftJoin(usersTable, eq(messagesTable.authorId, usersTable.id))
      .where(eq(messagesTable.id, id))
      .limit(1);

    if (result.length === 0) return null;
    return this.mapToDomainWithAuthor(result[0]);
  }

  async findByChannelId(channelId: string, limit = 50, beforeId?: string): Promise<Message[]> {
    const conditions = [eq(messagesTable.channelId, channelId)];

    if (beforeId) {
      conditions.push(lt(messagesTable.id, beforeId));
    }

    const rows = await this.db
      .select({
        id: messagesTable.id,
        channelId: messagesTable.channelId,
        authorId: messagesTable.authorId,
        content: messagesTable.content,
        pinned: messagesTable.pinned,
        editedAt: messagesTable.editedAt,
        createdAt: messagesTable.createdAt,
        authorName: usersTable.username,
        authorDiscriminator: usersTable.discriminator,
        authorAvatar: usersTable.avatar,
      })
      .from(messagesTable)
      .leftJoin(usersTable, eq(messagesTable.authorId, usersTable.id))
      .where(and(...conditions))
      .orderBy(desc(messagesTable.id))
      .limit(limit);

    return rows.reverse().map((r) => this.mapToDomainWithAuthor(r));
  }

  async updateContent(id: string, content: string): Promise<Message> {
    await this.db
      .update(messagesTable)
      .set({
        content,
        editedAt: new Date(),
      })
      .where(eq(messagesTable.id, id));

    const updated = await this.findById(id);
    if (!updated) {
      throw new NotFoundException('Mensagem não encontrada.');
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(messagesTable).where(eq(messagesTable.id, id));
  }

  private mapToDomainWithAuthor(row: MessageRowWithAuthor): Message {
    return new Message(
      row.id,
      row.channelId,
      row.authorId,
      row.content,
      row.pinned,
      row.editedAt,
      row.createdAt,
      row.authorName ?? undefined,
      row.authorDiscriminator ?? undefined,
      row.authorAvatar,
    );
  }
}
