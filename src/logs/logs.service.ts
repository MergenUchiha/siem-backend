import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLogDto, FilterLogDto } from './dto/create-log.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class LogsService {
  constructor(private prisma: PrismaService) {}

  async create(createLogDto: CreateLogDto) {
    return await this.prisma.log.create({
      data: createLogDto,
    });
  }

  async findAll(filterDto: FilterLogDto) {
    const { severity, source, search, page = 1, limit = 20 } = filterDto;
    
    const where: Prisma.LogWhereInput = {};

    if (severity) {
      where.severity = severity;
    }

    if (source) {
      where.source = source;
    }

    if (search) {
      where.OR = [
        { message: { contains: search, mode: 'insensitive' } },
        { ip: { contains: search } },
        { user: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.log.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.log.count({ where }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    return await this.prisma.log.findUnique({
      where: { id },
    });
  }

  async getSources() {
    const logs = await this.prisma.log.findMany({
      select: { source: true },
      distinct: ['source'],
    });
    
    return logs.map(log => log.source);
  }

  async getStats() {
    const total = await this.prisma.log.count();
    
    const severityCounts = await this.prisma.log.groupBy({
      by: ['severity'],
      _count: true,
    });

    const counts = severityCounts.reduce((acc, item) => {
      acc[item.severity] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      severityCounts: counts,
    };
  }

  async deleteOld(days: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const result = await this.prisma.log.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    return result;
  }

  async deleteAll() {
    return await this.prisma.log.deleteMany();
  }
}