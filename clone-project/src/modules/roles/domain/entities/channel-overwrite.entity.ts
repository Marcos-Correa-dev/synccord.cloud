export enum OverwriteType {
  ROLE = 0,
  MEMBER = 1,
}

/**
 * Pure Domain Channel Permission Overwrite Entity
 */
export class ChannelOverwrite {
  constructor(
    public readonly id: string,
    public readonly channelId: string,
    public readonly targetId: string, // Role ID or User ID
    public readonly type: OverwriteType,
    public readonly allow: string = '0', // 64-bit BigInt string
    public readonly deny: string = '0', // 64-bit BigInt string
    public readonly createdAt: Date = new Date(),
  ) {}
}
