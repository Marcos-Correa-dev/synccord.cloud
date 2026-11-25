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
    const emailNormalized = command.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(emailNormalized);
    if (!user) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    if (!user.verified) {
      throw new UnauthorizedException(
        'Sua conta ainda não foi confirmada. Acesse o link enviado ao seu e-mail para confirmar sua conta e definir sua senha antes de fazer login.',
      );
    }

    const isValid = await bcrypt.compare(command.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
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
