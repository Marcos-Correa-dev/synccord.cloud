import { Controller, Post, Body, Get, Patch, UseGuards, Request, Inject, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RegisterDto } from '../dtos/register.dto';
import { LoginDto } from '../dtos/login.dto';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';
import { AuthResponseDto, UserProfileDto } from '../dtos/auth-response.dto';
import { UpdateProfileDto } from '../dtos/update-profile.dto';
import { RegisterUseCase, REGISTER_USE_CASE } from '@modules/auth/application/ports/in/register.use-case';
import { LoginUseCase, LOGIN_USE_CASE } from '@modules/auth/application/ports/in/login.use-case';
import { RefreshTokenUseCase, REFRESH_TOKEN_USE_CASE } from '@modules/auth/application/ports/in/refresh-token.use-case';
import { UserRepositoryPort, USER_REPOSITORY_PORT } from '@modules/auth/application/ports/out/user-repository.port';
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
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new Discord user account' })
  @ApiResponse({ status: 201, description: 'User successfully created', type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    const result = await this.registerUseCase.execute(dto);
    return {
      user: {
        id: result.user.id,
        username: result.user.username,
        discriminator: result.user.discriminator,
        email: result.user.email,
        avatar: result.user.avatar,
        bot: result.user.bot,
      },
      token: result.token,
      refreshToken: result.refreshToken,
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
      user: {
        id: result.user.id,
        username: result.user.username,
        discriminator: result.user.discriminator,
        email: result.user.email,
        avatar: result.user.avatar,
        bot: result.user.bot,
      },
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
      user: {
        id: result.user.id,
        username: result.user.username,
        discriminator: result.user.discriminator,
        email: result.user.email,
        avatar: result.user.avatar,
        bot: result.user.bot,
      },
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
    return {
      id: req.user.id,
      username: req.user.username,
      discriminator: req.user.discriminator,
      email: req.user.email,
      avatar: req.user.avatar,
      bot: req.user.bot,
    };
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
    return {
      id: updated.id,
      username: updated.username,
      discriminator: updated.discriminator,
      email: updated.email,
      avatar: updated.avatar,
      bot: updated.bot,
    };
  }
}
