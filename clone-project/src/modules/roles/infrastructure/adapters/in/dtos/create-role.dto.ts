import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'Moderator', description: 'Name of the role' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 0x3498db, description: 'RGB integer color for the role' })
  @IsNumber()
  @IsOptional()
  color?: number;

  @ApiPropertyOptional({ example: true, description: 'Display role members separately in sidebar' })
  @IsBoolean()
  @IsOptional()
  hoist?: boolean;

  @ApiPropertyOptional({ example: 1, description: 'Sorting position of the role' })
  @IsNumber()
  @IsOptional()
  position?: number;

  @ApiPropertyOptional({ example: '104324160', description: 'Bitfield 64-bit permissions string' })
  @IsString()
  @IsOptional()
  permissions?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether the role can be mentioned by anyone' })
  @IsBoolean()
  @IsOptional()
  mentionable?: boolean;
}
