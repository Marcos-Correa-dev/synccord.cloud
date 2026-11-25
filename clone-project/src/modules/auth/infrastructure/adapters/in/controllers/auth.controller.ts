import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Query,
  UseGuards,
  Request,
  Req,
  Inject,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { Request as ExpressRequest } from 'express';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { RegisterDto } from '../dtos/register.dto';
import { LoginDto } from '../dtos/login.dto';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';
import { AuthResponseDto, UserProfileDto } from '../dtos/auth-response.dto';
import { UpdateProfileDto } from '../dtos/update-profile.dto';
import { RegisterUseCase, REGISTER_USE_CASE } from '@modules/auth/application/ports/in/register.use-case';
import { LoginUseCase, LOGIN_USE_CASE } from '@modules/auth/application/ports/in/login.use-case';
import { RefreshTokenUseCase, REFRESH_TOKEN_USE_CASE } from '@modules/auth/application/ports/in/refresh-token.use-case';
import { UserRepositoryPort, USER_REPOSITORY_PORT } from '@modules/auth/application/ports/out/user-repository.port';
import { EmailService } from '../../out/email.service';
import { JwtAuthGuard } from '../../out/jwt-auth.guard';
import { User } from '@modules/auth/domain/user.entity';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(REGISTER_USE_CASE)
    private readonly registerUseCase: RegisterUseCase,
    @Inject(LOGIN_USE_CASE)
    private readonly loginUseCase: LoginUseCase,
    @Inject(REFRESH_TOKEN_USE_CASE)
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    @Inject(USER_REPOSITORY_PORT)
    private readonly userRepo: UserRepositoryPort,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
  ) {}

  private toUserProfile(u: User): UserProfileDto {
    return {
      id: u.id,
      username: u.username,
      discriminator: u.discriminator,
      email: u.email,
      avatar: u.avatar,
      bot: u.bot,
      verified: u.verified,
    };
  }

  private resolveBaseUrl(req?: ExpressRequest): string {
    const configuredUrl = (process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || '').trim();
    if (configuredUrl) {
      return configuredUrl.replace(/\/+$/, '');
    }
    if (req) {
      const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
      const host = req.headers['host'] || 'localhost:3000';
      return `${proto}://${host}`;
    }
    return 'http://localhost:3000';
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new SyncCord user account and send confirmation email link' })
  @ApiResponse({ status: 201, description: 'User created or verification email sent', type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() dto: RegisterDto, @Req() req: ExpressRequest): Promise<AuthResponseDto> {
    const result = await this.registerUseCase.execute(dto);

    if (result.verificationRequired && result.verificationToken) {
      const baseUrl = this.resolveBaseUrl(req);
      const verifyLink = `${baseUrl}/?verifyEmail=${encodeURIComponent(result.verificationToken)}`;
      const emailResult = await this.emailService.sendVerificationEmail(
        result.user.email,
        result.user.username,
        verifyLink,
      );
      if (!emailResult.sent) {
        throw new BadRequestException(
          emailResult.error ||
            'Falha ao enviar o e-mail de confirmação via SMTP. Configure SMTP_USER e SMTP_PASS no arquivo .env.',
        );
      }
    }

    return {
      user: this.toUserProfile(result.user),
      token: result.token,
      refreshToken: result.refreshToken,
      verificationRequired: result.verificationRequired,
      message: result.message,
    };
  }

  @Get('verify-email-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate an email verification token from the confirmation link' })
  async validateEmailVerificationToken(
    @Query('token') token?: string,
  ): Promise<{ valid: boolean; email?: string; username?: string }> {
    const cleanToken = (token || '').trim();
    if (!cleanToken) {
      throw new BadRequestException('Token de confirmação ausente.');
    }
    const record = await this.userRepo.findEmailVerificationToken(cleanToken);
    if (!record || record.used || new Date() > new Date(record.expiresAt)) {
      throw new BadRequestException('Link de confirmação inválido ou expirado.');
    }
    const user = await this.userRepo.findById(record.userId);
    if (!user) {
      throw new BadRequestException('Usuário não encontrado.');
    }
    return { valid: true, email: user.email, username: user.username };
  }

  @Post('confirm-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm email address via token and apply user password' })
  @ApiResponse({ status: 200, description: 'Email confirmed and password set', type: AuthResponseDto })
  async confirmEmailAndSetPassword(
    @Body() body: { token: string; password: string },
  ): Promise<AuthResponseDto> {
    const token = (body?.token || '').trim();
    const password = body?.password || '';
    if (!token || !password || password.length < 6) {
      throw new BadRequestException('Token inválido ou senha com menos de 6 caracteres.');
    }

    const record = await this.userRepo.findEmailVerificationToken(token);
    if (!record || record.used || new Date() > new Date(record.expiresAt)) {
      throw new BadRequestException('Link de confirmação de e-mail inválido ou expirado.');
    }

    const user = await this.userRepo.findById(record.userId);
    if (!user) {
      throw new BadRequestException('Conta associada ao link não foi encontrada.');
    }

    const hash = await bcrypt.hash(password, 10);
    await this.userRepo.updatePassword(user.id, hash);
    await this.userRepo.markEmailVerificationTokenUsed(token);

    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, username: user.username },
      { expiresIn: '15m' },
    );
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d' },
    );

    return {
      user: { ...this.toUserProfile(user), verified: true },
      token: accessToken,
      refreshToken,
      message: 'E-mail confirmado e senha definida com sucesso!',
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    const result = await this.loginUseCase.execute(dto);
    return {
      user: this.toUserProfile(result.user),
      token: result.token,
      refreshToken: result.refreshToken,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a valid refresh token for a new access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    const result = await this.refreshTokenUseCase.execute({ refreshToken: dto.refreshToken });
    return {
      user: this.toUserProfile(result.user),
      token: result.token,
      refreshToken: result.refreshToken,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile', type: UserProfileDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(@Request() req: { user: User }): UserProfileDto {
    return this.toUserProfile(req.user);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile (username, avatar)' })
  @ApiResponse({ status: 200, description: 'Updated user profile', type: UserProfileDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @Request() req: { user: User },
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    const updated = new User(
      req.user.id,
      dto.username?.trim() ? dto.username.trim() : req.user.username,
      req.user.discriminator,
      req.user.email,
      req.user.passwordHash,
      dto.avatar !== undefined ? dto.avatar : req.user.avatar,
      req.user.bot,
      req.user.verified,
      req.user.createdAt,
      new Date(),
    );
    await this.userRepo.save(updated);
    return this.toUserProfile(updated);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset link sent strictly to the registered email' })
  async forgotPassword(
    @Body() body: { email: string },
    @Req() req: ExpressRequest,
  ): Promise<{ message: string }> {
    const email = (body?.email || '').trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Por favor, informe um e-mail válido.');
    }
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      throw new BadRequestException('Nenhuma conta encontrada com este endereço de e-mail.');
    }
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.userRepo.createPasswordResetToken(token, user.id, expiresAt);

    const baseUrl = this.resolveBaseUrl(req);
    const resetLink = `${baseUrl}/?reset=${encodeURIComponent(token)}`;
    const emailResult = await this.emailService.sendPasswordResetEmail(user.email, user.username, resetLink);

    if (!emailResult.sent) {
      throw new BadRequestException(
        emailResult.error ||
          'Falha ao enviar o e-mail de redefinição via SMTP. Configure SMTP_USER e SMTP_PASS no arquivo .env.',
      );
    }

    return {
      message: `Enviamos um e-mail com o link de redefinição de senha diretamente para ${user.email}. Verifique sua caixa de entrada (Gmail, Outlook, etc.) e clique no link recebido para criar sua nova senha.`,
    };
  }

  @Get('verify-reset-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify if a password reset token from an email link is valid' })
  async verifyResetToken(@Query('token') token?: string): Promise<{ valid: boolean; email?: string }> {
    const cleanToken = (token || '').trim();
    if (!cleanToken) {
      throw new BadRequestException('Token de redefinição ausente.');
    }
    const resetRecord = await this.userRepo.findPasswordResetToken(cleanToken);
    if (!resetRecord || resetRecord.used || new Date() > new Date(resetRecord.expiresAt)) {
      throw new BadRequestException('O link de redefinição é inválido ou já expirou.');
    }
    const user = await this.userRepo.findById(resetRecord.userId);
    return { valid: true, email: user?.email };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset user password using valid token from email link' })
  async resetPassword(@Body() body: { token: string; password: string }): Promise<{ message: string }> {
    const token = (body?.token || '').trim();
    const newPassword = body?.password || '';
    if (!token || !newPassword || newPassword.length < 6) {
      throw new BadRequestException('Token inválido ou senha com menos de 6 caracteres.');
    }
    const resetRecord = await this.userRepo.findPasswordResetToken(token);
    if (!resetRecord || resetRecord.used || new Date() > new Date(resetRecord.expiresAt)) {
      throw new BadRequestException('Token de redefinição inválido ou expirado.');
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.updatePassword(resetRecord.userId, hash);
    await this.userRepo.markPasswordResetTokenUsed(token);
    return { message: 'Senha atualizada com sucesso. Você já pode fazer login com sua nova senha.' };
  }
}
