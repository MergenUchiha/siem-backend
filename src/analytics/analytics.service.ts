import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardMetrics() {
    const [
      totalEvents,
      criticalAlerts,
      openIncidents,
      investigatingIncidents,
    ] = await Promise.all([
      this.prisma.log.count(),
      this.prisma.log.count({ where: { severity: 'critical' } }),
      this.prisma.incident.count({ where: { status: 'open' } }),
      this.prisma.incident.count({ where: { status: 'investigating' } }),
    ]);

    const activeIncidents = openIncidents + investigatingIncidents;

    // Calculate threats blocked (logs with critical/high severity)
    const threatsBlocked = await this.prisma.log.count({
      where: {
        OR: [
          { severity: 'critical' },
          { severity: 'high' },
        ],
      },
    });

    // Calculate security score (simplified algorithm)
    const recentCriticalLogs = await this.prisma.log.count({
      where: {
        severity: 'critical',
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
    });

    // Score from 0-100, penalize for recent critical events
    const securityScore = Math.max(50, Math.min(100, 100 - (recentCriticalLogs * 5)));

    return {
      totalEvents,
      criticalAlerts,
      activeIncidents,
      securityScore,
      threatsBlocked,
      lastUpdate: new Date().toISOString(),
    };
  }

  async getTimeSeriesData(hours: number = 24) {
    const now = new Date();
    const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);

    const logs = await this.prisma.log.findMany({
      where: {
        timestamp: {
          gte: startTime,
        },
      },
      select: {
        timestamp: true,
        severity: true,
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    // Group by hour
    const hourlyData = new Map<string, any>();

    for (let i = 0; i < hours; i++) {
      const hourDate = new Date(startTime.getTime() + i * 60 * 60 * 1000);
      const hourKey = hourDate.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      hourlyData.set(hourKey, {
        time: hourDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        timestamp: hourDate.toISOString(),
        events: 0,
        critical: 0,
        high: 0,
        threats: 0,
      });
    }

    logs.forEach(log => {
      const hourKey = log.timestamp.toISOString().slice(0, 13);
      const data = hourlyData.get(hourKey);
      if (data) {
        data.events++;
        if (log.severity === 'critical') {
          data.critical++;
          data.threats++;
        }
        if (log.severity === 'high') {
          data.high++;
          data.threats++;
        }
      }
    });

    return Array.from(hourlyData.values());
  }

  async getSourceDistribution() {
    const sourceGroups = await this.prisma.log.groupBy({
      by: ['source'],
      _count: true,
    });

    const total = await this.prisma.log.count();

    return sourceGroups.map(item => ({
      source: item.source,
      count: item._count,
      percentage: ((item._count / total) * 100).toFixed(1),
    })).sort((a, b) => b.count - a.count);
  }

  async getSeverityDistribution() {
    const severityGroups = await this.prisma.log.groupBy({
      by: ['severity'],
      _count: true,
    });

    return severityGroups.map(item => ({
      name: item.severity.charAt(0).toUpperCase() + item.severity.slice(1),
      value: item._count,
    }));
  }

  async getTopIPs(limit: number = 10) {
    const ipGroups = await this.prisma.$queryRaw<Array<{ ip: string; count: bigint }>>`
      SELECT ip, COUNT(*) as count
      FROM logs
      GROUP BY ip
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    return ipGroups.map(item => ({
      ip: item.ip,
      requests: Number(item.count),
    }));
  }
}