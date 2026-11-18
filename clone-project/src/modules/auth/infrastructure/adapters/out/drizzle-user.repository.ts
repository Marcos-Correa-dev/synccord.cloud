import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { User } from '@modules/auth/domain/user.entity';
import { UserRepositoryPort } from '@modules/auth/application/ports/out/user-repository.port';
import { DRIZZLE_DB, AppDatabase } from '@infrastructure/database/database.module';
import { usersTable } from '@infrastructure/database/schema';

@Injectable()
export class DrizzleUserRepository implements UserRepositoryPort {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: AppDatabase,
  ) {}

  async findById(id: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async save(user: User): Promise<User> {
    await this.db
      .insert(usersTable)
      .values({
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        email: user.email,
        passwordHash: user.passwordHash,
        avatar: user.avatar,
        bot: user.bot,
        verified: user.verified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .onConflictDoUpdate({
        target: usersTable.id,
        set: {
          username: user.username,
          avatar: user.avatar,
          updatedAt: new Date(),
        },
      });

    return user;
  }

  private mapToDomain(row: typeof usersTable.$inferSelect): User {
    return new User(
      row.id,
      row.username,
      row.discriminator,
      row.email,
      row.passwordHash,
      row.avatar,
      row.bot,
      row.verified,
      row.createdAt,
      row.updatedAt,
    );
  }
}
