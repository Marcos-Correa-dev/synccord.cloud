import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty({ example: '133742849204829184', description: '64-bit Snowflake ID' })
  id: string;

  @ApiProperty({ example: 'marcosdev', description: 'Username' })
  username: string;

  @ApiProperty({ example: '1337', description: '4-digit discriminator' })
  discriminator: string;

  @ApiProperty({ example: 'marcos@example.com', description: 'User email' })
  email: string;

  @ApiPropertyOptional({ example: 'https://cdn.discordapp.com/avatars/1337/avatar.png', nullable: true })
  avatar: string | null;

  @ApiProperty({ example: false, description: 'Whether the user is an automated bot' })
  bot: boolean;

  @ApiPropertyOptional({ example: true, description: 'Whether the user email is verified' })
  verified?: boolean;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserProfileDto, description: 'Authenticated user profile' })
  user: UserProfileDto;

  @ApiPropertyOptional({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Bearer JWT access token',
  })
  token?: string;

  @ApiPropertyOptional({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Bearer JWT refresh token for session renewal',
  })
  refreshToken?: string;

  @ApiPropertyOptional({ example: false, description: 'Whether email verification is required before password setup' })
  verificationRequired?: boolean;

  @ApiPropertyOptional({ description: 'Confirmation message' })
  message?: string;
}
