import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  RefreshTokenCommand,
  RefreshTokenUseCase,
  AuthTokensResult,
} from '../ports/in/refresh-token.use-case';
import { UserRepositoryPort, USER_REPOSITORY_PORT } from '../ports/out/user-repository.port';

@Injectable()
export class RefreshTokenService implements RefreshTokenUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    private readonly jwtService: JwtService,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<AuthTokensResult> {
    if (!command.refreshToken) {
      throw new UnauthorizedException('Refresh token is required.');
    }

    let payload: { sub?: string; type?: string };
    try {
      payload = this.jwtService.verify(command.refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    if (!payload.sub || payload.type !== 'refresh') {
      throw new UnauthorizedException('Token is not a valid refresh token.');
    }

    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists.');
    }

    const token = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        username: user.username,
      },
      { expiresIn: '15m' },
    );

    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        type: 'refresh',
      },
      { expiresIn: '7d' },
    );

    return { user, token, refreshToken };
  }
}
