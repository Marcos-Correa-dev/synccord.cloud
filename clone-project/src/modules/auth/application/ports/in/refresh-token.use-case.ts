import { User } from '../../../domain/user.entity';

export const REFRESH_TOKEN_USE_CASE = Symbol('REFRESH_TOKEN_USE_CASE');

export interface RefreshTokenCommand {
  refreshToken: string;
}

export interface AuthTokensResult {
  user: User;
  token: string;
  refreshToken: string;
}

export interface RefreshTokenUseCase {
  execute(command: RefreshTokenCommand): Promise<AuthTokensResult>;
}
