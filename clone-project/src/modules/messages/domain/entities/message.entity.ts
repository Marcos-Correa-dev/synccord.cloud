/**
 * Pure Domain Message Entity
 */
export class Message {
  constructor(
    public readonly id: string,
    public readonly channelId: string,
    public readonly authorId: string,
    public readonly content: string,
    public readonly pinned: boolean = false,
    public readonly editedAt: Date | null = null,
    public readonly createdAt: Date = new Date(),
    public readonly authorName?: string,
    public readonly authorDiscriminator?: string,
    public readonly authorAvatar?: string | null,
  ) {}
}
