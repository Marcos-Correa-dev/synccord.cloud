import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GuildResponseDto {
  @ApiProperty({ example: '133742849204829184', description: 'Snowflake ID of the guild' })
  id: string;

  @ApiProperty({ example: 'Comunidade TypeScript', description: 'Guild name' })
  name: string;

  @ApiProperty({ example: '133700000000000001', description: 'User ID of the guild owner' })
  ownerId: string;

  @ApiPropertyOptional({ example: 'https://cdn.discordapp.com/icons/guild-icon.png', nullable: true })
  icon: string | null;

  @ApiPropertyOptional({ example: 'Servidor oficial da comunidade', nullable: true })
  description: string | null;

  @ApiProperty({ example: '2026-11-09T10:00:00.000Z', description: 'Creation date ISO' })
  createdAt: Date;
}
