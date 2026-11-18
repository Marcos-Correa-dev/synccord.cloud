import { User } from '../../../domain/user.entity';

export interface LoginCommand {
  email: string;
  password: string;
}

export const LOGIN_USE_CASE = 'LOGIN_USE_CASE';

export interface LoginUseCase {
  execute(command: LoginCommand): Promise<{ user: User; token: string; refreshToken?: string }>;
}
