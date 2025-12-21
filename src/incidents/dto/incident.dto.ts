import { IsString, IsEnum, IsArray, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum IncidentSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum IncidentStatus {
  OPEN = 'open',
  INVESTIGATING = 'investigating',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export class CreateIncidentDto {
  @ApiProperty({ example: 'Brute Force Attack Detected' })
  @IsString()
  title: string;

  @ApiProperty({ enum: IncidentSeverity, example: 'high' })
  @IsEnum(IncidentSeverity)
  severity: IncidentSeverity;

  @ApiProperty({ example: ['Web Server', 'Auth Service'] })
  @IsArray()
  @IsString({ each: true })
  affectedSystems: string[];

  @ApiProperty({ example: 'Multiple failed login attempts from various IPs' })
  @IsString()
  description: string;

  @ApiProperty({ example: 'security-team@company.com', required: false })
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiProperty({ example: ['brute-force', 'authentication'], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateIncidentDto {
  @ApiProperty({ enum: IncidentStatus, required: false })
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  affectedSystems?: string[];
}

export class FilterIncidentDto {
  @ApiProperty({ required: false, enum: IncidentStatus })
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @ApiProperty({ required: false, enum: IncidentSeverity })
  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;
}