import { Global, Module, OnModuleDestroy, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DRIZZLE_DB = 'DRIZZLE_DB';
export const PG_POOL = 'PG_POOL';

export type AppDatabase = NodePgDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () => {
        const connectionString =
          process.env.DATABASE_URL ||
          'postgresql://postgres:postgres@localhost:5432/synccord_db';

        const isSsl =
          connectionString.includes('sslmode=require') ||
          process.env.NODE_ENV === 'production';

        const pool = new Pool({
          connectionString,
          ssl: isSsl ? { rejectUnauthorized: false } : undefined,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        });

        return pool;
      },
    },
    {
      provide: DRIZZLE_DB,
      inject: [PG_POOL],
      useFactory: (pool: Pool) => {
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DRIZZLE_DB, PG_POOL],
})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleInit() {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS roles (
          id VARCHAR(32) PRIMARY KEY,
          guild_id VARCHAR(32) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          color INTEGER NOT NULL DEFAULT 0,
          hoist BOOLEAN NOT NULL DEFAULT FALSE,
          position INTEGER NOT NULL DEFAULT 0,
          permissions VARCHAR(32) NOT NULL DEFAULT '0',
          managed BOOLEAN NOT NULL DEFAULT FALSE,
          mentionable BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS channel_overwrites (
          id VARCHAR(32) PRIMARY KEY,
          channel_id VARCHAR(32) NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
          target_id VARCHAR(32) NOT NULL,
          type INTEGER NOT NULL DEFAULT 0,
          allow VARCHAR(32) NOT NULL DEFAULT '0',
          deny VARCHAR(32) NOT NULL DEFAULT '0',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_roles_guild_id ON roles(guild_id);
        CREATE INDEX IF NOT EXISTS idx_channel_overwrites_channel_id ON channel_overwrites(channel_id);
        CREATE INDEX IF NOT EXISTS idx_channel_overwrites_target_id ON channel_overwrites(target_id);
      `);
      this.logger.log('Database tables verified / initialized successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Database auto-init warning: ${message}`);
    }
  }

  async onModuleDestroy() {
    // Graceful shutdown handling
  }
}
