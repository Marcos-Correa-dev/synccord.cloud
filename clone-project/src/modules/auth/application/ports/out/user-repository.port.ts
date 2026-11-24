import { User } from '../../../domain/user.entity';

export const USER_REPOSITORY_PORT = 'USER_REPOSITORY_PORT';

export interface UserRepositoryPort {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<User>;
  updatePassword(userId: string, newPasswordHash: string): Promise<void>;
  markUserVerified(userId: string): Promise<void>;
  createPasswordResetToken(token: string, userId: string, expiresAt: Date): Promise<void>;
  findPasswordResetToken(token: string): Promise<{ userId: string; expiresAt: Date; used: boolean } | null>;
  markPasswordResetTokenUsed(token: string): Promise<void>;
  createEmailVerificationToken(token: string, userId: string, email: string, expiresAt: Date): Promise<void>;
  findEmailVerificationToken(token: string): Promise<{ userId: string; email: string; expiresAt: Date; used: boolean } | null>;
  markEmailVerificationTokenUsed(token: string): Promise<void>;
}
