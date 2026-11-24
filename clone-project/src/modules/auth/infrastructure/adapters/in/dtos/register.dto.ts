import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'marcosdev',
    description: 'Username for the Discord user account',
    minLength: 2,
    maxLength: 32,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(32)
  username: string;

  @ApiProperty({
    example: 'marcos@example.com',
    description: 'Unique email address for authentication',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    example: 'SecretPassword123!',
    description: 'Optional initial password (if not provided, password will be set after email confirmation link)',
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
