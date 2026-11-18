import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({ example: '133742849204829184', description: 'Snowflake ID of the message' })
  id: string;

  @ApiProperty({ example: '133700000000000001', description: 'Channel ID' })
  channelId: string;

  @ApiProperty({ example: '133700000000000002', description: 'Author User ID' })
  authorId: string;

  @ApiPropertyOptional({ example: 'marcos', description: 'Author Username' })
  authorName?: string;

  @ApiPropertyOptional({ example: '0001', description: 'Author Discriminator' })
  authorDiscriminator?: string;

  @ApiPropertyOptional({ example: 'data:image/...', nullable: true, description: 'Author Avatar' })
  authorAvatar?: string | null;

  @ApiProperty({ example: 'E aí pessoal, tudo pronto?', description: 'Message content' })
  content: string;

  @ApiProperty({ example: false, description: 'Whether the message is pinned' })
  pinned: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  editedAt: Date | null;

  @ApiProperty({ example: '2026-11-09T10:00:00.000Z' })
  createdAt: Date;
}
