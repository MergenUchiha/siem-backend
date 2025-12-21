import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto, UpdateIncidentDto, FilterIncidentDto } from './dto/incident.dto';

@ApiTags('incidents')
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new incident' })
  @ApiResponse({ status: 201, description: 'Incident created successfully' })
  create(@Body() createIncidentDto: CreateIncidentDto) {
    return this.incidentsService.create(createIncidentDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all incidents with optional filtering' })
  @ApiResponse({ status: 200, description: 'Incidents retrieved successfully' })
  findAll(@Query() filterDto: FilterIncidentDto) {
    return this.incidentsService.findAll(filterDto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get incident statistics' })
  getStats() {
    return this.incidentsService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific incident by ID' })
  findOne(@Param('id') id: string) {
    return this.incidentsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an incident' })
  @ApiResponse({ status: 200, description: 'Incident updated successfully' })
  update(@Param('id') id: string, @Body() updateIncidentDto: UpdateIncidentDto) {
    return this.incidentsService.update(id, updateIncidentDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an incident' })
  @ApiResponse({ status: 200, description: 'Incident deleted successfully' })
  remove(@Param('id') id: string) {
    return this.incidentsService.remove(id);
  }
}