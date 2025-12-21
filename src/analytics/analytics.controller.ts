import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard metrics' })
  getDashboardMetrics() {
    return this.analyticsService.getDashboardMetrics();
  }

  @Get('time-series')
  @ApiOperation({ summary: 'Get time series data' })
  getTimeSeriesData(@Query('hours') hours?: string) {
    return this.analyticsService.getTimeSeriesData(hours ? parseInt(hours) : 24);
  }

  @Get('sources')
  @ApiOperation({ summary: 'Get source distribution' })
  getSourceDistribution() {
    return this.analyticsService.getSourceDistribution();
  }

  @Get('severity')
  @ApiOperation({ summary: 'Get severity distribution' })
  getSeverityDistribution() {
    return this.analyticsService.getSeverityDistribution();
  }

  @Get('top-ips')
  @ApiOperation({ summary: 'Get top IPs' })
  getTopIPs(@Query('limit') limit?: string) {
    return this.analyticsService.getTopIPs(limit ? parseInt(limit) : 10);
  }
}