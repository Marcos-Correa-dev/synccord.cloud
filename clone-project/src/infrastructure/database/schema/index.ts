import { pgTable, varchar, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

export const usersTable = pgTable('users', {
  id: varchar('id', { length: 32 }).primaryKey(),
  username: varchar('username', { length: 32 }).notNull(),
  discriminator: varchar('discriminator', { length: 4 }).notNull().default('0001'),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  avatar: text('avatar'),
  bot: boolean('bot').notNull().default(false),
  verified: boolean('verified').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const guildsTable = pgTable('guilds', {
  id: varchar('id', { length: 32 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  ownerId: varchar('owner_id', { length: 32 }).references(() => usersTable.id).notNull(),
  icon: text('icon'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const guildMembersTable = pgTable('guild_members', {
  guildId: varchar('guild_id', { length: 32 }).references(() => guildsTable.id).notNull(),
  userId: varchar('user_id', { length: 32 }).references(() => usersTable.id).notNull(),
  nickname: varchar('nickname', { length: 64 }),
  roles: text('roles').notNull().default('[]'), // JSON string array of role IDs
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
});

export const channelsTable = pgTable('channels', {
  id: varchar('id', { length: 32 }).primaryKey(),
  guildId: varchar('guild_id', { length: 32 }).references(() => guildsTable.id),
  name: varchar('name', { length: 100 }).notNull(),
  type: integer('type').notNull().default(0), // 0: Text, 2: Voice, 4: Category
  topic: text('topic'),
  position: integer('position').notNull().default(0),
  parentId: varchar('parent_id', { length: 32 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const messagesTable = pgTable('messages', {
  id: varchar('id', { length: 32 }).primaryKey(),
  channelId: varchar('channel_id', { length: 32 }).references(() => channelsTable.id).notNull(),
  authorId: varchar('author_id', { length: 32 }).references(() => usersTable.id).notNull(),
  content: text('content').notNull(),
  pinned: boolean('pinned').notNull().default(false),
  editedAt: timestamp('edited_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rolesTable = pgTable('roles', {
  id: varchar('id', { length: 32 }).primaryKey(),
  guildId: varchar('guild_id', { length: 32 }).references(() => guildsTable.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  color: integer('color').notNull().default(0),
  hoist: boolean('hoist').notNull().default(false),
  position: integer('position').notNull().default(0),
  permissions: varchar('permissions', { length: 32 }).notNull().default('0'),
  managed: boolean('managed').notNull().default(false),
  mentionable: boolean('mentionable').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const channelOverwritesTable = pgTable('channel_overwrites', {
  id: varchar('id', { length: 32 }).primaryKey(),
  channelId: varchar('channel_id', { length: 32 }).references(() => channelsTable.id).notNull(),
  targetId: varchar('target_id', { length: 32 }).notNull(), // roleId or userId
  type: integer('type').notNull().default(0), // 0: Role, 1: Member
  allow: varchar('allow', { length: 32 }).notNull().default('0'),
  deny: varchar('deny', { length: 32 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const passwordResetTokensTable = pgTable('password_reset_tokens', {
  token: varchar('token', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 32 }).references(() => usersTable.id).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  used: boolean('used').notNull().default(false),
});
