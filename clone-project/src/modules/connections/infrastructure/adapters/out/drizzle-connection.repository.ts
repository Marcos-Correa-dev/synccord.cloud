import { Injectable, Inject } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE_DB, AppDatabase } from '@infrastructure/database/database.module';
import { userAuthorizedAppsTable, userConnectionsTable } from '@infrastructure/database/schema';
import {
  AuthorizedApp,
  ConnectionProvider,
  UserConnection,
} from '@modules/connections/domain/connection.types';

@Injectable()
export class DrizzleConnectionRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: AppDatabase,
  ) {}

  async findUserConnections(userId: string): Promise<UserConnection[]> {
    const rows = await this.db
      .select()
      .from(userConnectionsTable)
      .where(eq(userConnectionsTable.userId, userId))
      .orderBy(desc(userConnectionsTable.connectedAt));

    return rows.map((r) => this.mapConnection(r));
  }

  async upsertConnection(conn: UserConnection): Promise<UserConnection> {
    const existing = await this.db
      .select()
      .from(userConnectionsTable)
      .where(
        and(
          eq(userConnectionsTable.userId, conn.userId),
          eq(userConnectionsTable.provider, conn.provider),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(userConnectionsTable)
        .set({
          providerAccountId: conn.providerAccountId,
          providerUsername: conn.providerUsername,
          profileUrl: conn.profileUrl,
          avatarUrl: conn.avatarUrl,
          accessToken: conn.accessToken ?? existing[0].accessToken,
          refreshToken: conn.refreshToken ?? existing[0].refreshToken,
          showOnProfile: conn.showOnProfile,
          metadata: conn.metadata ?? existing[0].metadata,
          connectedAt: new Date(),
        })
        .where(eq(userConnectionsTable.id, existing[0].id));

      return { ...conn, id: existing[0].id, connectedAt: new Date() };
    }

    await this.db.insert(userConnectionsTable).values({
      id: conn.id,
      userId: conn.userId,
      provider: conn.provider,
      providerAccountId: conn.providerAccountId,
      providerUsername: conn.providerUsername,
      profileUrl: conn.profileUrl,
      avatarUrl: conn.avatarUrl,
      accessToken: conn.accessToken ?? null,
      refreshToken: conn.refreshToken ?? null,
      showOnProfile: conn.showOnProfile,
      metadata: conn.metadata ?? null,
      connectedAt: conn.connectedAt,
    });

    return conn;
  }

  async updateVisibility(
    userId: string,
    provider: ConnectionProvider,
    showOnProfile: boolean,
  ): Promise<UserConnection | null> {
    const rows = await this.db
      .select()
      .from(userConnectionsTable)
      .where(
        and(
          eq(userConnectionsTable.userId, userId),
          eq(userConnectionsTable.provider, provider),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;

    await this.db
      .update(userConnectionsTable)
      .set({ showOnProfile })
      .where(eq(userConnectionsTable.id, rows[0].id));

    return this.mapConnection({ ...rows[0], showOnProfile });
  }

  async deleteConnection(userId: string, provider: ConnectionProvider): Promise<boolean> {
    await this.db
      .delete(userConnectionsTable)
      .where(
        and(
          eq(userConnectionsTable.userId, userId),
          eq(userConnectionsTable.provider, provider),
        ),
      );
    return true;
  }

  async findAuthorizedApps(userId: string): Promise<AuthorizedApp[]> {
    const rows = await this.db
      .select()
      .from(userAuthorizedAppsTable)
      .where(eq(userAuthorizedAppsTable.userId, userId))
      .orderBy(desc(userAuthorizedAppsTable.authorizedAt));

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      appName: r.appName,
      appIcon: r.appIcon,
      scopes: r.scopes,
      authorizedAt: r.authorizedAt,
    }));
  }

  async revokeAuthorizedApp(userId: string, appId: string): Promise<boolean> {
    await this.db
      .delete(userAuthorizedAppsTable)
      .where(
        and(
          eq(userAuthorizedAppsTable.userId, userId),
          eq(userAuthorizedAppsTable.id, appId),
        ),
      );
    return true;
  }

  private mapConnection(row: typeof userConnectionsTable.$inferSelect): UserConnection {
    return {
      id: row.id,
      userId: row.userId,
      provider: row.provider as ConnectionProvider,
      providerAccountId: row.providerAccountId,
      providerUsername: row.providerUsername,
      profileUrl: row.profileUrl,
      avatarUrl: row.avatarUrl,
      showOnProfile: row.showOnProfile,
      metadata: row.metadata,
      connectedAt: row.connectedAt,
    };
  }
}
