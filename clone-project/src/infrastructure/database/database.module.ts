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

        const isLocalhost =
          connectionString.includes('localhost') ||
          connectionString.includes('127.0.0.1');

        const isSsl = !isLocalhost && connectionString.includes('sslmode=require');

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
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(32) PRIMARY KEY,
          username VARCHAR(32) NOT NULL,
          discriminator VARCHAR(4) NOT NULL DEFAULT '0001',
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          avatar TEXT,
          bot BOOLEAN NOT NULL DEFAULT FALSE,
          verified BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS guilds (
          id VARCHAR(32) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          owner_id VARCHAR(32) NOT NULL REFERENCES users(id),
          icon TEXT,
          description TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS guild_members (
          guild_id VARCHAR(32) NOT NULL REFERENCES guilds(id),
          user_id VARCHAR(32) NOT NULL REFERENCES users(id),
          nickname VARCHAR(64),
          roles TEXT NOT NULL DEFAULT '[]',
          joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (guild_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS channels (
          id VARCHAR(32) PRIMARY KEY,
          guild_id VARCHAR(32) REFERENCES guilds(id),
          name VARCHAR(100) NOT NULL,
          type INTEGER NOT NULL DEFAULT 0,
          topic TEXT,
          position INTEGER NOT NULL DEFAULT 0,
          parent_id VARCHAR(32),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS messages (
          id VARCHAR(32) PRIMARY KEY,
          channel_id VARCHAR(32) NOT NULL REFERENCES channels(id),
          author_id VARCHAR(32) NOT NULL REFERENCES users(id),
          content TEXT NOT NULL,
          pinned BOOLEAN NOT NULL DEFAULT FALSE,
          edited_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

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

        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          token VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL,
          used BOOLEAN NOT NULL DEFAULT FALSE
        );

        CREATE TABLE IF NOT EXISTS email_verification_tokens (
          token VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          email VARCHAR(255) NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          used BOOLEAN NOT NULL DEFAULT FALSE
        );

        CREATE TABLE IF NOT EXISTS dm_participants (
          channel_id VARCHAR(32) NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
          user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (channel_id, user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_roles_guild_id ON roles(guild_id);
        CREATE INDEX IF NOT EXISTS idx_channel_overwrites_channel_id ON channel_overwrites(channel_id);
        CREATE INDEX IF NOT EXISTS idx_channel_overwrites_target_id ON channel_overwrites(target_id);
        CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_dm_participants_user_id ON dm_participants(user_id);
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
