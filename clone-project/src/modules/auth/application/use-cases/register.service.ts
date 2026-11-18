import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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

  async execute(command: RegisterCommand): Promise<{ user: User; token: string; refreshToken?: string }> {
    const existing = await this.userRepository.findByEmail(command.email);
    if (existing) {
      throw new ConflictException('Email is already registered.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(command.password, salt);

    const id = Snowflake.generate();
    const discriminator = Math.floor(1000 + Math.random() * 9000).toString();

    const newUser = new User(
      id,
      command.username,
      discriminator,
      command.email,
      passwordHash,
    );

    const savedUser = await this.userRepository.save(newUser);
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
