import { Permissions, ALL_PERMISSIONS } from '@shared/constants/discord.constants';
import { Role } from '../entities/role.entity';
import { ChannelOverwrite, OverwriteType } from '../entities/channel-overwrite.entity';

export interface ComputePermissionsContext {
  userId: string;
  guildId: string;
  guildOwnerId: string;
  memberRoleIds: string[];
  guildRoles: Role[];
  channelOverwrites?: ChannelOverwrite[];
}

/**
 * Domain Service: Discord 64-Bit Bitfield Permission Resolution Calculator.
 * Follows Discord official permissions resolution hierarchy.
 */
export class PermissionCalculator {
  /**
   * Computes the effective 64-bit permission bitfield for a member in a guild and optional channel.
   */
  public static compute(context: ComputePermissionsContext): bigint {
    const {
      userId,
      guildId,
      guildOwnerId,
      memberRoleIds,
      guildRoles,
      channelOverwrites = [],
    } = context;

    // 1. Guild owner always has all permissions
    if (userId === guildOwnerId) {
      return ALL_PERMISSIONS;
    }

    // 2. Base permissions from @everyone role (role with ID == guildId or name == '@everyone')
    const everyoneRole = guildRoles.find(
      (r) => r.id === guildId || r.name === '@everyone',
    );
    let permissions = everyoneRole ? BigInt(everyoneRole.permissions) : 0n;

    // 3. Union with all roles assigned to member
    const memberRoles = guildRoles.filter((r) => memberRoleIds.includes(r.id));
    for (const role of memberRoles) {
      permissions |= BigInt(role.permissions);
    }

    // 4. Administrator bypasses all channel overwrites
    if ((permissions & Permissions.ADMINISTRATOR) === Permissions.ADMINISTRATOR) {
      return ALL_PERMISSIONS;
    }

    // If no channel overwrites apply, return guild-level permissions
    if (!channelOverwrites.length) {
      return permissions;
    }

    // 5. Apply channel @everyone overwrite
    const everyoneOverwrite = channelOverwrites.find(
      (ow) =>
        (ow.targetId === guildId || ow.targetId === everyoneRole?.id) &&
        ow.type === OverwriteType.ROLE,
    );
    if (everyoneOverwrite) {
      permissions &= ~BigInt(everyoneOverwrite.deny);
      permissions |= BigInt(everyoneOverwrite.allow);
    }

    // 6. Apply channel role overwrites (combined)
    let roleAllow = 0n;
    let roleDeny = 0n;
    for (const roleId of memberRoleIds) {
      const roleOverwrite = channelOverwrites.find(
        (ow) => ow.targetId === roleId && ow.type === OverwriteType.ROLE,
      );
      if (roleOverwrite) {
        roleAllow |= BigInt(roleOverwrite.allow);
        roleDeny |= BigInt(roleOverwrite.deny);
      }
    }
    permissions &= ~roleDeny;
    permissions |= roleAllow;

    // 7. Apply channel member-specific overwrite (highest priority)
    const memberOverwrite = channelOverwrites.find(
      (ow) => ow.targetId === userId && ow.type === OverwriteType.MEMBER,
    );
    if (memberOverwrite) {
      permissions &= ~BigInt(memberOverwrite.deny);
      permissions |= BigInt(memberOverwrite.allow);
    }

    return permissions;
  }

  /**
   * Helper to test if a bitfield has a specific permission.
   */
  public static has(permissions: bigint, required: bigint): boolean {
    if ((permissions & Permissions.ADMINISTRATOR) === Permissions.ADMINISTRATOR) {
      return true;
    }
    return (permissions & required) === required;
  }
}
