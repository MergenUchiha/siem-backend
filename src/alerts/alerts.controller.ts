import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all alert rules' })
  findAll() {
    return this.alertsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get alert rule by ID' })
  findOne(@Param('id') id: string) {
    return this.alertsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new alert rule' })
  create(@Body() createAlertDto: any) {
    return this.alertsService.create(createAlertDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update alert rule' })
  update(@Param('id') id: string, @Body() updateAlertDto: any) {
    return this.alertsService.update(id, updateAlertDto);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle alert enabled/disabled' })
  toggleEnabled(@Param('id') id: string) {
    return this.alertsService.toggleEnabled(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete alert rule' })
  remove(@Param('id') id: string) {
    return this.alertsService.remove(id);
  }
}