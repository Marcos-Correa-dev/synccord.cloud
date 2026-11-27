import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ConnectionProvider, SUPPORTED_PROVIDERS } from '@modules/connections/domain/connection.types';

export class LinkConnectionDto {
  @ApiProperty({ enum: SUPPORTED_PROVIDERS, example: 'youtube' })
  @IsString()
  @IsIn(SUPPORTED_PROVIDERS)
  provider: ConnectionProvider;

  @ApiPropertyOptional({
    example: '@marcoscorrea',
    description: 'Username, handle, or profile URL to synchronize when direct sync is used',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  handle?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  showOnProfile?: boolean;
}

export class UpdateConnectionDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  showOnProfile: boolean;
}
