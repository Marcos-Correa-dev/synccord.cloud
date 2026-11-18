import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { Role } from '@modules/roles/domain/entities/role.entity';
import { ChannelOverwrite, OverwriteType } from '@modules/roles/domain/entities/channel-overwrite.entity';
import { RoleRepositoryPort } from '@modules/roles/application/ports/out/role-repository.port';
import { DRIZZLE_DB, AppDatabase } from '@infrastructure/database/database.module';
import { rolesTable, guildMembersTable, channelOverwritesTable } from '@infrastructure/database/schema';

@Injectable()
export class DrizzleRoleRepository implements RoleRepositoryPort {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: AppDatabase,
  ) {}

  async create(role: Role): Promise<Role> {
    await this.db.insert(rolesTable).values({
      id: role.id,
      guildId: role.guildId,
      name: role.name,
      color: role.color,
      hoist: role.hoist,
      position: role.position,
      permissions: role.permissions,
      managed: role.managed,
      mentionable: role.mentionable,
      createdAt: role.createdAt,
    });
    return role;
  }

  async findById(id: string): Promise<Role | null> {
    const result = await this.db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
    if (result.length === 0) return null;
    return this.mapToDomain(result[0]);
  }

  async findByGuildId(guildId: string): Promise<Role[]> {
    const rows = await this.db.select().from(rolesTable).where(eq(rolesTable.guildId, guildId));
    return rows.map((r) => this.mapToDomain(r));
  }

  async update(role: Role): Promise<Role> {
    await this.db
      .update(rolesTable)
      .set({
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        position: role.position,
        permissions: role.permissions,
        mentionable: role.mentionable,
      })
      .where(eq(rolesTable.id, role.id));
    return role;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(rolesTable).where(eq(rolesTable.id, id));
  }

  async addRoleToMember(guildId: string, userId: string, roleId: string): Promise<void> {
    const member = await this.db
      .select()
      .from(guildMembersTable)
      .where(and(eq(guildMembersTable.guildId, guildId), eq(guildMembersTable.userId, userId)))
      .limit(1);

    if (member.length === 0) return;

    let roles: string[] = [];
    try {
      roles = JSON.parse(member[0].roles || '[]');
    } catch {
      roles = [];
    }

    if (!roles.includes(roleId)) {
      roles.push(roleId);
      await this.db
        .update(guildMembersTable)
        .set({ roles: JSON.stringify(roles) })
        .where(and(eq(guildMembersTable.guildId, guildId), eq(guildMembersTable.userId, userId)));
    }
  }

  async removeRoleFromMember(guildId: string, userId: string, roleId: string): Promise<void> {
    const member = await this.db
      .select()
      .from(guildMembersTable)
      .where(and(eq(guildMembersTable.guildId, guildId), eq(guildMembersTable.userId, userId)))
      .limit(1);

    if (member.length === 0) return;

    let roles: string[] = [];
    try {
      roles = JSON.parse(member[0].roles || '[]');
    } catch {
      roles = [];
    }

    const filtered = roles.filter((r) => r !== roleId);
    await this.db
      .update(guildMembersTable)
      .set({ roles: JSON.stringify(filtered) })
      .where(and(eq(guildMembersTable.guildId, guildId), eq(guildMembersTable.userId, userId)));
  }

  async getMemberRoleIds(guildId: string, userId: string): Promise<string[]> {
    const member = await this.db
      .select()
      .from(guildMembersTable)
      .where(and(eq(guildMembersTable.guildId, guildId), eq(guildMembersTable.userId, userId)))
      .limit(1);

    if (member.length === 0) return [];
    try {
      return JSON.parse(member[0].roles || '[]');
    } catch {
      return [];
    }
  }

  async saveChannelOverwrite(overwrite: ChannelOverwrite): Promise<ChannelOverwrite> {
    await this.db
      .insert(channelOverwritesTable)
      .values({
        id: overwrite.id,
        channelId: overwrite.channelId,
        targetId: overwrite.targetId,
        type: overwrite.type,
        allow: overwrite.allow,
        deny: overwrite.deny,
        createdAt: overwrite.createdAt,
      })
      .onConflictDoUpdate({
        target: channelOverwritesTable.id,
        set: {
          allow: overwrite.allow,
          deny: overwrite.deny,
        },
      });
    return overwrite;
  }

  async findChannelOverwrites(channelId: string): Promise<ChannelOverwrite[]> {
    const rows = await this.db
      .select()
      .from(channelOverwritesTable)
      .where(eq(channelOverwritesTable.channelId, channelId));

    return rows.map(
      (r) =>
        new ChannelOverwrite(
          r.id,
          r.channelId,
          r.targetId,
          r.type as OverwriteType,
          r.allow,
          r.deny,
          r.createdAt,
        ),
    );
  }

  async deleteChannelOverwrite(channelId: string, targetId: string): Promise<void> {
    await this.db
      .delete(channelOverwritesTable)
      .where(
        and(
          eq(channelOverwritesTable.channelId, channelId),
          eq(channelOverwritesTable.targetId, targetId),
        ),
      );
  }

  private mapToDomain(row: typeof rolesTable.$inferSelect): Role {
    return new Role(
      row.id,
      row.guildId,
      row.name,
      row.color,
      row.hoist,
      row.position,
      row.permissions,
      row.managed,
      row.mentionable,
      row.createdAt,
    );
  }
}
