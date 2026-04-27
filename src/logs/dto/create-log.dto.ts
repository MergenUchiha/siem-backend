import { IsString, IsEnum, IsOptional, IsIP, IsObject, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum SeverityLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

export class CreateLogDto {
  @ApiProperty({ description: 'Log source', example: 'Web Server' })
  @IsString()
  source: string;

  @ApiProperty({ enum: SeverityLevel, example: 'high' })
  @IsEnum(SeverityLevel)
  severity: SeverityLevel;

  @ApiProperty({ description: 'Log message', example: 'Failed login attempt detected' })
  @IsString()
  message: string;

  @ApiProperty({ description: 'IP address', example: '192.168.1.100' })
  @IsIP()
  ip: string;

  @ApiProperty({ description: 'Username', example: 'admin', required: false })
  @IsOptional()
  @IsString()
  user?: string;

  @ApiProperty({ description: 'Action performed', example: 'Login Attempt' })
  @IsString()
  action: string;

  @ApiProperty({ description: 'Additional details', required: false })
  @IsOptional()
  @IsObject()
  details?: Record<string, any>;
}

export class FilterLogDto {
  @ApiProperty({ required: false, enum: SeverityLevel })
  @IsOptional()
  @IsEnum(SeverityLevel)
  severity?: SeverityLevel;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, description: 'Filter logs from this date (ISO string or YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiProperty({ required: false, description: 'Filter logs up to this date (ISO string or YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiProperty({ required: false, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}