import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { OverwriteType } from '@modules/roles/domain/entities/channel-overwrite.entity';

export class SetChannelOverwriteDto {
  @ApiProperty({ example: '133742849204829184', description: 'Target Role ID or User ID' })
  @IsString()
  @IsNotEmpty()
  targetId: string;

  @ApiProperty({ enum: OverwriteType, example: 0, description: '0 for Role, 1 for Member' })
  @IsEnum(OverwriteType)
  type: OverwriteType;

  @ApiPropertyOptional({ example: '2048', description: 'Allowed permissions bitfield string' })
  @IsString()
  @IsOptional()
  allow?: string;

  @ApiPropertyOptional({ example: '0', description: 'Denied permissions bitfield string' })
  @IsString()
  @IsOptional()
  deny?: string;
}

export class ChannelOverwriteResponseDto {
  @ApiProperty({ example: '133742849204829184' })
  id: string;

  @ApiProperty({ example: '133742849204829100' })
  channelId: string;

  @ApiProperty({ example: '133742849204829184' })
  targetId: string;

  @ApiProperty({ example: 0 })
  type: number;

  @ApiProperty({ example: '2048' })
  allow: string;

  @ApiProperty({ example: '0' })
  deny: string;

  @ApiProperty()
  createdAt: Date;
}
