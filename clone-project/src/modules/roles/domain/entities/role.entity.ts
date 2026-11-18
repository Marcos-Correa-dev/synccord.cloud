/**
 * Pure Domain Role Entity
 */
export class Role {
  constructor(
    public readonly id: string,
    public readonly guildId: string,
    public readonly name: string,
    public readonly color: number = 0,
    public readonly hoist: boolean = false,
    public readonly position: number = 0,
    public readonly permissions: string = '0', // 64-bit BigInt string
    public readonly managed: boolean = false,
    public readonly mentionable: boolean = false,
    public readonly createdAt: Date = new Date(),
  ) {}

  public hasPermission(permission: bigint): boolean {
    const rolePerms = BigInt(this.permissions);
    return (rolePerms & permission) === permission;
  }
}
