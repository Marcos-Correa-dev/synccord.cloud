/**
 * Pure Domain Channel Entity
 */
export class Channel {
  constructor(
    public readonly id: string,
    public readonly guildId: string | null,
    public readonly name: string,
    public readonly type: number = 0,
    public readonly topic: string | null = null,
    public readonly position: number = 0,
    public readonly parentId: string | null = null,
    public readonly createdAt: Date = new Date(),
  ) {}
}
