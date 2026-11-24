import { User } from '../../../domain/user.entity';

export interface RegisterCommand {
  username: string;
  email: string;
  password?: string;
}

export const REGISTER_USE_CASE = 'REGISTER_USE_CASE';

export interface RegisterUseCase {
  execute(command: RegisterCommand): Promise<{
    user: User;
    token?: string;
    refreshToken?: string;
    verificationRequired?: boolean;
    verificationToken?: string;
    message?: string;
  }>;
}
