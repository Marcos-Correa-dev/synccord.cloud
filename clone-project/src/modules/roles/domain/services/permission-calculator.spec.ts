import { PermissionCalculator } from './permission-calculator';
import { Permissions, ALL_PERMISSIONS, DEFAULT_PERMISSIONS } from '@shared/constants/discord.constants';
import { Role } from '../entities/role.entity';
import { ChannelOverwrite, OverwriteType } from '../entities/channel-overwrite.entity';

describe('PermissionCalculator (Discord 64-bit Bitfield Resolution)', () => {
  const guildId = '100000000000000001';
  const ownerId = '200000000000000001';
  const userId = '300000000000000001';
  const roleModId = '400000000000000001';

  const everyoneRole = new Role(
    guildId,
    guildId,
    '@everyone',
    0,
    false,
    0,
    DEFAULT_PERMISSIONS.toString(),
  );

  const modRole = new Role(
    roleModId,
    guildId,
    'Moderator',
    0x3498db,
    true,
    1,
    (Permissions.KICK_MEMBERS | Permissions.BAN_MEMBERS | Permissions.MANAGE_MESSAGES).toString(),
  );

  it('should grant ALL_PERMISSIONS to the guild owner', () => {
    const perms = PermissionCalculator.compute({
      userId: ownerId,
      guildId,
      guildOwnerId: ownerId,
      memberRoleIds: [],
      guildRoles: [everyoneRole],
    });

    expect(perms).toBe(ALL_PERMISSIONS);
    expect(PermissionCalculator.has(perms, Permissions.ADMINISTRATOR)).toBe(true);
    expect(PermissionCalculator.has(perms, Permissions.MANAGE_GUILD)).toBe(true);
  });

  it('should compute base permissions for regular member from @everyone', () => {
    const perms = PermissionCalculator.compute({
      userId,
      guildId,
      guildOwnerId: ownerId,
      memberRoleIds: [],
      guildRoles: [everyoneRole],
    });

    expect(perms).toBe(DEFAULT_PERMISSIONS);
    expect(PermissionCalculator.has(perms, Permissions.SEND_MESSAGES)).toBe(true);
    expect(PermissionCalculator.has(perms, Permissions.BAN_MEMBERS)).toBe(false);
  });

  it('should union member roles with @everyone permissions', () => {
    const perms = PermissionCalculator.compute({
      userId,
      guildId,
      guildOwnerId: ownerId,
      memberRoleIds: [roleModId],
      guildRoles: [everyoneRole, modRole],
    });

    expect(PermissionCalculator.has(perms, Permissions.SEND_MESSAGES)).toBe(true);
    expect(PermissionCalculator.has(perms, Permissions.KICK_MEMBERS)).toBe(true);
    expect(PermissionCalculator.has(perms, Permissions.BAN_MEMBERS)).toBe(true);
    expect(PermissionCalculator.has(perms, Permissions.ADMINISTRATOR)).toBe(false);
  });

  it('should bypass channel overwrites if member has ADMINISTRATOR', () => {
    const adminRole = new Role(
      'admin-role-id',
      guildId,
      'Admin',
      0,
      true,
      2,
      Permissions.ADMINISTRATOR.toString(),
    );

    const denyOverwrite = new ChannelOverwrite(
      'ow-1',
      'chan-1',
      guildId,
      OverwriteType.ROLE,
      '0',
      Permissions.SEND_MESSAGES.toString(),
    );

    const perms = PermissionCalculator.compute({
      userId,
      guildId,
      guildOwnerId: ownerId,
      memberRoleIds: ['admin-role-id'],
      guildRoles: [everyoneRole, adminRole],
      channelOverwrites: [denyOverwrite],
    });

    expect(perms).toBe(ALL_PERMISSIONS);
    expect(PermissionCalculator.has(perms, Permissions.SEND_MESSAGES)).toBe(true);
  });

  it('should apply channel role overwrites and member-specific overwrites', () => {
    // Channel denies SEND_MESSAGES to @everyone
    const denyEveryoneSend = new ChannelOverwrite(
      'ow-everyone',
      'chan-read-only',
      guildId,
      OverwriteType.ROLE,
      '0',
      Permissions.SEND_MESSAGES.toString(),
    );

    // Regular member cannot send
    const regularPerms = PermissionCalculator.compute({
      userId,
      guildId,
      guildOwnerId: ownerId,
      memberRoleIds: [],
      guildRoles: [everyoneRole],
      channelOverwrites: [denyEveryoneSend],
    });
    expect(PermissionCalculator.has(regularPerms, Permissions.SEND_MESSAGES)).toBe(false);

    // Member-specific overwrite explicitly allows SEND_MESSAGES to this specific user
    const allowUserSend = new ChannelOverwrite(
      'ow-vip-user',
      'chan-read-only',
      userId,
      OverwriteType.MEMBER,
      Permissions.SEND_MESSAGES.toString(),
      '0',
    );

    const vipPerms = PermissionCalculator.compute({
      userId,
      guildId,
      guildOwnerId: ownerId,
      memberRoleIds: [],
      guildRoles: [everyoneRole],
      channelOverwrites: [denyEveryoneSend, allowUserSend],
    });
    expect(PermissionCalculator.has(vipPerms, Permissions.SEND_MESSAGES)).toBe(true);
  });
});
