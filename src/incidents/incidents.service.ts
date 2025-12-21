import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncidentDto, UpdateIncidentDto, FilterIncidentDto, IncidentStatus } from './dto/incident.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class IncidentsService {
  constructor(private prisma: PrismaService) {}

  async create(createIncidentDto: CreateIncidentDto) {
    return await this.prisma.incident.create({
      data: {
        ...createIncidentDto,
        status: IncidentStatus.OPEN,
        tags: createIncidentDto.tags || [],
      },
    });
  }

  async findAll(filterDto: FilterIncidentDto) {
    const { status, severity } = filterDto;
    
    const where: Prisma.IncidentWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (severity) {
      where.severity = severity;
    }

    return await this.prisma.incident.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });
  }

  async findOne(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }

    return incident;
  }

  async update(id: string, updateIncidentDto: UpdateIncidentDto) {
    await this.findOne(id); // Check if exists

    const data: any = { ...updateIncidentDto };

    // If status is being changed to resolved, set resolvedAt
    if (updateIncidentDto.status === IncidentStatus.RESOLVED) {
      data.resolvedAt = new Date();
    }

    return await this.prisma.incident.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Check if exists
    
    return await this.prisma.incident.delete({
      where: { id },
    });
  }

  async getStats() {
    const total = await this.prisma.incident.count();
    
    const statusCounts = await this.prisma.incident.groupBy({
      by: ['status'],
      _count: true,
    });

    const severityCounts = await this.prisma.incident.groupBy({
      by: ['severity'],
      _count: true,
    });

    return {
      total,
      statusCounts: statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
      severityCounts: severityCounts.reduce((acc, item) => {
        acc[item.severity] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  async deleteAll() {
    return await this.prisma.incident.deleteMany();
  }
}