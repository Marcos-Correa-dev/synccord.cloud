import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateChannelDto {
  @ApiPropertyOptional({ example: 'bate-papo', description: 'Updated name of the channel', minLength: 1, maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({ example: 'Novo tópico do canal', description: 'Updated channel topic' })
  @IsOptional()
  @IsString()
  topic?: string;
}
