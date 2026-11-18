/**
 * Pure Domain User Entity
 * Free from ORM or framework dependencies.
 */
export class User {
  constructor(
    public readonly id: string,
    public readonly username: string,
    public readonly discriminator: string,
    public readonly email: string,
    public readonly passwordHash: string,
    public readonly avatar: string | null = null,
    public readonly bot: boolean = false,
    public readonly verified: boolean = false,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
  ) {}

  public get tag(): string {
    return `${this.username}#${this.discriminator}`;
  }
}
