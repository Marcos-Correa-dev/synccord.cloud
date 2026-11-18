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
