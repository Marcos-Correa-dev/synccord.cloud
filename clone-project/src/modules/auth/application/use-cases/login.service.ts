import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../../domain/user.entity';
import { LoginCommand, LoginUseCase } from '../ports/in/login.use-case';
import { UserRepositoryPort, USER_REPOSITORY_PORT } from '../ports/out/user-repository.port';

@Injectable()
export class LoginService implements LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    private readonly jwtService: JwtService,
  ) {}

  async execute(command: LoginCommand): Promise<{ user: User; token: string; refreshToken?: string }> {
    const user = await this.userRepository.findByEmail(command.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isValid = await bcrypt.compare(command.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password.');
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
