import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

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

  @ApiProperty({
    example: 'SecretPassword123!',
    description: 'Password for the account (minimum 6 characters)',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
