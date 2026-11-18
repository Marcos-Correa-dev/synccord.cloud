import { ApiProperty } from '@nestjs/swagger';

export class RoleResponseDto {
  @ApiProperty({ example: '133742849204829184' })
  id: string;

  @ApiProperty({ example: '133742849204829100' })
  guildId: string;

  @ApiProperty({ example: 'Moderator' })
  name: string;

  @ApiProperty({ example: 0x3498db })
  color: number;

  @ApiProperty({ example: true })
  hoist: boolean;

  @ApiProperty({ example: 1 })
  position: number;

  @ApiProperty({ example: '104324160' })
  permissions: string;

  @ApiProperty({ example: false })
  managed: boolean;

  @ApiProperty({ example: true })
  mentionable: boolean;

  @ApiProperty()
  createdAt: Date;
}
