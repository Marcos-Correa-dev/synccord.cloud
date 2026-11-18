import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateGuildDto {
  @ApiProperty({
    example: 'Comunidade TypeScript',
    description: 'The name of the guild (server)',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @ApiPropertyOptional({
    example: 'https://cdn.discordapp.com/icons/guild-icon.png',
    description: 'Icon URL for the server',
  })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({
    example: 'Servidor oficial para desenvolvedores TypeScript e NestJS',
    description: 'Server description',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
