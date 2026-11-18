/**
 * Pure Domain Guild (Server) Entity
 */
export class Guild {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly ownerId: string,
    public readonly icon: string | null = null,
    public readonly description: string | null = null,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
  ) {}
}
