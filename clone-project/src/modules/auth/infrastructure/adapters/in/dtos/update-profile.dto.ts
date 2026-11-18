import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: 'marcos.correa',
    description: 'New username for the Discord user account',
  })
  @IsOptional()
  @IsString()
  @Length(2, 32)
  username?: string;

  @ApiPropertyOptional({
    example: 'data:image/png;base64,...',
    description: 'Avatar image URL or Base64 data string',
  })
  @IsOptional()
  @IsString()
  avatar?: string;
}
