import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AlertsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return await this.prisma.alert.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return await this.prisma.alert.findUnique({
      where: { id },
    });
  }

  async create(data: any) {
    return await this.prisma.alert.create({
      data: {
        ...data,
        condition: JSON.stringify(data.condition),
        action: JSON.stringify(data.action),
      },
    });
  }

  async update(id: string, data: any) {
    const updateData: any = { ...data };
    
    if (data.condition) {
      updateData.condition = JSON.stringify(data.condition);
    }
    if (data.action) {
      updateData.action = JSON.stringify(data.action);
    }

    return await this.prisma.alert.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    return await this.prisma.alert.delete({
      where: { id },
    });
  }

  async toggleEnabled(id: string) {
    const alert = await this.findOne(id);
    if(!alert) {
      throw new NotFoundException('Alert not f')
    }
    return await this.prisma.alert.update({
      where: { id },
      data: { enabled: !alert.enabled },
    });
  }
}