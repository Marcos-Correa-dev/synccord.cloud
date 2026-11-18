import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as schema from './schema';
import { Snowflake } from '../../shared/snowflake/snowflake';
import { ChannelType } from '../../shared/constants/discord.constants';

dotenv.config();

async function seed() {
  console.log('🌱 Starting SyncCord database seeding...');

  const connectionString =
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5435/synccord_db';

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  // 0. Ensure all tables exist
  console.log('📦 Verifying / creating database tables...');
  await pool.query(`
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
  `);

  // 1. Create Default User: marcos
  const userId = Snowflake.generate();
  const passwordHash = await bcrypt.hash('Password123!', 10);

  console.log('👤 Seeding default user: marcos (marcos@synccord.cloud / Password123!)...');
  await db
    .insert(schema.usersTable)
    .values({
      id: userId,
      username: 'marcos',
      discriminator: '1337',
      email: 'marcos@synccord.cloud',
      passwordHash,
      verified: true,
      bot: false,
    })
    .onConflictDoNothing();

  // 2. Create Default Guild: "Comunidade SyncCord"
  const guildId = Snowflake.generate();
  console.log('🏰 Seeding default guild: Comunidade SyncCord...');
  await db
    .insert(schema.guildsTable)
    .values({
      id: guildId,
      name: 'Comunidade SyncCord',
      ownerId: userId,
      description: 'Servidor oficial da comunidade SyncCord',
    })
    .onConflictDoNothing();

  // Add owner to members
  await db
    .insert(schema.guildMembersTable)
    .values({
      guildId,
      userId,
      roles: JSON.stringify(['owner', 'admin']),
    })
    .onConflictDoNothing();

  // 3. Create Channels: Category, #geral, #anúncios, Voice
  const catId = Snowflake.generate();
  await db.insert(schema.channelsTable).values({
    id: catId,
    guildId,
    name: 'CANAIS DE TEXTO',
    type: ChannelType.GUILD_CATEGORY,
    position: 0,
  });

  const textId = Snowflake.generate();
  await db.insert(schema.channelsTable).values({
    id: textId,
    guildId,
    name: 'geral',
    type: ChannelType.GUILD_TEXT,
    parentId: catId,
    topic: 'Canal principal de conversas',
    position: 0,
  });

  const announceId = Snowflake.generate();
  await db.insert(schema.channelsTable).values({
    id: announceId,
    guildId,
    name: 'anúncios',
    type: ChannelType.GUILD_TEXT,
    parentId: catId,
    topic: 'Anúncios importantes da comunidade',
    position: 1,
  });

  const voiceId = Snowflake.generate();
  await db.insert(schema.channelsTable).values({
    id: voiceId,
    guildId,
    name: 'Lounge de Voz',
    type: ChannelType.GUILD_VOICE,
    parentId: catId,
    position: 2,
  });

  // 4. Create Initial Welcome Messages in #geral
  console.log('💬 Seeding welcome messages in #geral...');
  await db.insert(schema.messagesTable).values([
    {
      id: Snowflake.generate(),
      channelId: textId,
      authorId: userId,
      content: '👋 Olá mundo! Sejam bem-vindos ao SyncCord!',
    },
    {
      id: Snowflake.generate(),
      channelId: textId,
      authorId: userId,
      content: '🚀 O backend com NestJS Hexagonal, PostgreSQL e WebSocket Gateway está 100% operacional!',
    },
  ]);

  console.log('✅ Seeding completed successfully!');
  await pool.end();
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
