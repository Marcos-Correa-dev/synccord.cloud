import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChannelResponseDto {
  @ApiProperty({ example: '133742849204829184', description: 'Snowflake ID of the channel' })
  id: string;

  @ApiPropertyOptional({ example: '133700000000000000', description: 'Guild ID the channel belongs to' })
  guildId: string | null;

  @ApiProperty({ example: 'anúncios', description: 'Channel name' })
  name: string;

  @ApiProperty({ example: 0, description: 'Type of channel: 0=Text, 2=Voice, 4=Category' })
  type: number;

  @ApiPropertyOptional({ example: 'Tópico do canal', nullable: true })
  topic: string | null;

  @ApiProperty({ example: 0, description: 'Sorting position index' })
  position: number;

  @ApiPropertyOptional({ example: '133700000000000001', nullable: true })
  parentId: string | null;

  @ApiProperty({ example: '2026-11-09T10:00:00.000Z' })
  createdAt: Date;
}
