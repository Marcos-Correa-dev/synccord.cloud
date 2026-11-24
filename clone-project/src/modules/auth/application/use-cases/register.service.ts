import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { User } from '../../domain/user.entity';
import { RegisterCommand, RegisterUseCase } from '../ports/in/register.use-case';
import { UserRepositoryPort, USER_REPOSITORY_PORT } from '../ports/out/user-repository.port';
import { Snowflake } from '@shared/snowflake/snowflake';

@Injectable()
export class RegisterService implements RegisterUseCase {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepository: UserRepositoryPort,
    private readonly jwtService: JwtService,
  ) {}

  async execute(command: RegisterCommand): Promise<{
    user: User;
    token?: string;
    refreshToken?: string;
    verificationRequired?: boolean;
    verificationToken?: string;
    message?: string;
  }> {
    const emailNormalized = command.email.trim().toLowerCase();
    const existing = await this.userRepository.findByEmail(emailNormalized);

    if (existing && existing.verified) {
      throw new ConflictException('Este e-mail já está cadastrado e verificado.');
    }

    const salt = await bcrypt.genSalt(10);
    const hasPassword = Boolean(command.password && command.password.length >= 6);
    const passwordHash = hasPassword
      ? await bcrypt.hash(command.password!, salt)
      : 'PENDING_EMAIL_VERIFICATION';

    const id = existing ? existing.id : Snowflake.generate();
    const discriminator = existing
      ? existing.discriminator
      : Math.floor(1000 + Math.random() * 9000).toString();

    const newUser = new User(
      id,
      command.username.trim(),
      discriminator,
      emailNormalized,
      passwordHash,
      existing?.avatar ?? null,
      false,
      hasPassword,
    );

    const savedUser = await this.userRepository.save(newUser);

    if (!hasPassword) {
      const verificationToken = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await this.userRepository.createEmailVerificationToken(
        verificationToken,
        savedUser.id,
        savedUser.email,
        expiresAt,
      );

      return {
        user: savedUser,
        verificationRequired: true,
        verificationToken,
        message: 'Enviamos um link de confirmação para o seu e-mail. Confirme seu e-mail para definir sua senha.',
      };
    }

    const token = this.jwtService.sign(
      {
        sub: savedUser.id,
        email: savedUser.email,
        username: savedUser.username,
      },
      { expiresIn: '15m' },
    );

    const refreshToken = this.jwtService.sign(
      {
        sub: savedUser.id,
        type: 'refresh',
      },
      { expiresIn: '7d' },
    );

    return { user: savedUser, token, refreshToken };
  }
}
