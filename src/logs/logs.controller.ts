import { Controller, Get, Post, Body, Param, Query, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LogsService } from './logs.service';
import { CreateLogDto, FilterLogDto } from './dto/create-log.dto';

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

  @Get()
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
}