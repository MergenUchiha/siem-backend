import {
  Controller,
  Get,
  Post,
  Head,
  Body,
  Param,
  Query,
  Delete,
  Headers,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { LogsService } from './logs.service';
import {
  CreateLogDto,
  FilterLogDto,
  SeverityLevel,
} from './dto/create-log.dto';

@ApiTags('logs')
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new log entry' })
  @ApiResponse({ status: 201, description: 'Log created successfully' })
  create(@Body() createLogDto: CreateLogDto) {
    return this.logsService.create(createLogDto);
  }

  // SIEM проверяет соединение через HEAD /api/logs/ingest
  @Head('ingest')
  @HttpCode(200)
  @ApiOperation({ summary: 'Test ingest endpoint connectivity' })
  testIngest(@Headers('x-api-key') apiKey: string) {
    this.validateApiKey(apiKey);
  }

  @Post('ingest')
  @ApiOperation({
    summary: 'Ingest logs from external sources (requires API key)',
  })
  @ApiHeader({
    name: 'x-api-key',
    required: true,
    description: 'API Key for external log ingestion',
  })
  @ApiResponse({ status: 201, description: 'Log ingested successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  async ingestLog(@Body() logData: any, @Headers('x-api-key') apiKey: string) {
    this.validateApiKey(apiKey);

    const normalizedLog: CreateLogDto = {
      source: logData.source || logData.host || logData.hostname || 'External',
      severity: this.mapSeverity(
        logData.level || logData.severity || logData.priority || 'info',
      ),
      message: logData.message || logData.msg || logData.log || 'No message',
      ip:
        logData.ip ||
        logData.src_ip ||
        logData.source_ip ||
        logData.host ||
        '0.0.0.0',
      action:
        logData.action || logData.event_type || logData.event || 'Unknown',
      user: logData.user || logData.username || logData.account,
      details: logData,
    };

    return await this.logsService.create(normalizedLog);
  }

  // SIEM проверяет pull через GET /api/logs
  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'Get all logs with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Logs retrieved successfully' })
  findAll(@Query() filterDto: FilterLogDto) {
    return this.logsService.findAll(filterDto);
  }

  @Get('sources')
  @ApiOperation({ summary: 'Get all unique log sources' })
  getSources() {
    return this.logsService.getSources();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get log statistics' })
  getStats() {
    return this.logsService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific log by ID' })
  findOne(@Param('id') id: string) {
    return this.logsService.findOne(id);
  }

  @Delete('cleanup/:days')
  @ApiOperation({ summary: 'Delete logs older than specified days' })
  deleteOld(@Param('days') days: string) {
    return this.logsService.deleteOld(parseInt(days));
  }

  private validateApiKey(apiKey: string) {
    const validApiKey =
      process.env.INGEST_API_KEY || 'siem-ingest-key-change-in-production';
    if (!apiKey || apiKey !== validApiKey) {
      throw new UnauthorizedException('Invalid or missing API key');
    }
  }

  private mapSeverity(level: string | number): SeverityLevel {
    if (typeof level === 'number') {
      const syslogMapping: Record<number, SeverityLevel> = {
        0: SeverityLevel.CRITICAL,
        1: SeverityLevel.CRITICAL,
        2: SeverityLevel.CRITICAL,
        3: SeverityLevel.HIGH,
        4: SeverityLevel.MEDIUM,
        5: SeverityLevel.LOW,
        6: SeverityLevel.INFO,
        7: SeverityLevel.INFO,
      };
      return syslogMapping[level] || SeverityLevel.INFO;
    }

    const levelStr = level.toString().toLowerCase();
    const mapping: Record<string, SeverityLevel> = {
      emerg: SeverityLevel.CRITICAL,
      emergency: SeverityLevel.CRITICAL,
      alert: SeverityLevel.CRITICAL,
      crit: SeverityLevel.CRITICAL,
      critical: SeverityLevel.CRITICAL,
      err: SeverityLevel.HIGH,
      error: SeverityLevel.HIGH,
      warn: SeverityLevel.MEDIUM,
      warning: SeverityLevel.MEDIUM,
      notice: SeverityLevel.LOW,
      info: SeverityLevel.INFO,
      informational: SeverityLevel.INFO,
      debug: SeverityLevel.INFO,
      fatal: SeverityLevel.CRITICAL,
      severe: SeverityLevel.CRITICAL,
      high: SeverityLevel.HIGH,
      medium: SeverityLevel.MEDIUM,
      low: SeverityLevel.LOW,
      '0': SeverityLevel.CRITICAL,
      '1': SeverityLevel.CRITICAL,
      '2': SeverityLevel.CRITICAL,
      '3': SeverityLevel.HIGH,
      '4': SeverityLevel.MEDIUM,
      '5': SeverityLevel.LOW,
      '6': SeverityLevel.INFO,
      '7': SeverityLevel.INFO,
    };

    return mapping[levelStr] || SeverityLevel.INFO;
  }
}
