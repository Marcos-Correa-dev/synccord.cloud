import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsInt, Length } from 'class-validator';

export class CreateChannelDto {
  @ApiProperty({ example: 'anúncios', description: 'Name of the channel', minLength: 1, maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional({ example: 0, description: 'Channel type (0 = Text, 2 = Voice, 4 = Category)' })
  @IsOptional()
  @IsInt()
  type?: number;

  @ApiPropertyOptional({ example: 'Canal de anúncios importantes', description: 'Channel topic' })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional({ example: '133700000000000000', description: 'Parent Category ID' })
  @IsOptional()
  @IsString()
  parentId?: string;
}
