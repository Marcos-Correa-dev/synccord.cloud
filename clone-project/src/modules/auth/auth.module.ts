import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './infrastructure/adapters/in/controllers/auth.controller';
import { RegisterService } from './application/use-cases/register.service';
import { LoginService } from './application/use-cases/login.service';
import { RefreshTokenService } from './application/use-cases/refresh-token.service';
import { REGISTER_USE_CASE } from './application/ports/in/register.use-case';
import { LOGIN_USE_CASE } from './application/ports/in/login.use-case';
import { REFRESH_TOKEN_USE_CASE } from './application/ports/in/refresh-token.use-case';
import { USER_REPOSITORY_PORT } from './application/ports/out/user-repository.port';
import { DrizzleUserRepository } from './infrastructure/adapters/out/drizzle-user.repository';
import { JwtStrategy } from './infrastructure/adapters/out/jwt.strategy';
import { JwtAuthGuard } from './infrastructure/adapters/out/jwt-auth.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super_secret_discord_jwt_key_change_in_production_2026',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: REGISTER_USE_CASE,
      useClass: RegisterService,
    },
    {
      provide: LOGIN_USE_CASE,
      useClass: LoginService,
    },
    {
      provide: REFRESH_TOKEN_USE_CASE,
      useClass: RefreshTokenService,
    },
    {
      provide: USER_REPOSITORY_PORT,
      useClass: DrizzleUserRepository,
    },
    JwtStrategy,
    JwtAuthGuard,
  ],
  exports: [USER_REPOSITORY_PORT, JwtAuthGuard],
})
export class AuthModule {}
