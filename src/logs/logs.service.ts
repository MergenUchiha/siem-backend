import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { CreateLogDto, FilterLogDto } from './dto/create-log.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class LogsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => EventsGateway))
    private eventsGateway: EventsGateway,
  ) {}

  async create(createLogDto: CreateLogDto) {
    // 1. Сохраняем лог в БД
    const log = await this.prisma.log.create({
      data: createLogDto,
    });

    // 2. Проверяем Alert Rules (правила алертов)
    await this.checkAlertRules(log);

    // 3. Автоматическое создание инцидентов для критичных событий
    if (log.severity === 'critical' || log.severity === 'high') {
      await this.autoCreateIncident(log);
    }

    // 4. Broadcast через WebSocket всем подключенным клиентам
    this.eventsGateway.broadcastNewLog(log);

    // 5. Отправляем внешние уведомления (email, slack, etc)
    await this.sendExternalNotifications(log);

    return log;
  }

  // Проверка правил алертов
  private async checkAlertRules(log: any) {
    // Получаем все активные правила алертов
    const activeAlerts = await this.prisma.alert.findMany({
      where: { enabled: true },
    });

    for (const alert of activeAlerts) {
      const condition = JSON.parse(alert.condition);
      
      // Проверяем условие
      if (this.evaluateCondition(log, condition)) {
        console.log(`🚨 Alert triggered: ${alert.name}`);
        
        // Выполняем действие
        const action = JSON.parse(alert.action);
        await this.executeAlertAction(alert, log, action);
      }
    }
  }

  // Оценка условия алерта
  private evaluateCondition(log: any, condition: any): boolean {
    // Простая проверка по severity
    if (condition.field === 'severity' && condition.operator === 'equals') {
      return log.severity === condition.value;
    }

    // Проверка по source
    if (condition.field === 'source' && condition.operator === 'equals') {
      return log.source === condition.value;
    }

    // Проверка contains в message
    if (condition.field === 'message' && condition.operator === 'contains') {
      return log.message.toLowerCase().includes(condition.value.toLowerCase());
    }

    // Проверка по IP
    if (condition.field === 'ip' && condition.operator === 'equals') {
      return log.ip === condition.value;
    }

    return false;
  }

  // Выполнение действия алерта
  private async executeAlertAction(alert: any, log: any, action: any) {
    console.log(`📤 Executing action: ${action.type}`);

    switch (action.type) {
      case 'email':
        // Отправка email через внешний сервис
        await this.sendEmail(action.target, alert.name, log);
        break;
        
      case 'slack':
        // Отправка в Slack
        await this.sendSlack(action.target, alert.name, log);
        break;
        
      case 'webhook':
        // HTTP webhook
        await this.sendWebhook(action.target, alert.name, log);
        break;
        
      case 'create_incident':
        // Автоматическое создание инцидента
        await this.autoCreateIncident(log, alert.name);
        break;
    }
  }

  // Автоматическое создание инцидента
  private async autoCreateIncident(log: any, alertName?: string) {
    // Проверяем, не был ли уже создан инцидент для похожего события
    const recentIncident = await this.prisma.incident.findFirst({
      where: {
        title: { contains: log.message.substring(0, 50) },
        timestamp: {
          gte: new Date(Date.now() - 3600000), // За последний час
        },
      },
    });

    // Если уже есть похожий инцидент - не создаем дубликат
    if (recentIncident) {
      console.log(`⚠️  Similar incident already exists: ${recentIncident.id}`);
      return;
    }

    // Создаем новый инцидент
    const incident = await this.prisma.incident.create({
      data: {
        title: alertName ? `[${alertName}] ${log.message.substring(0, 100)}` : `Auto: ${log.message.substring(0, 100)}`,
        severity: log.severity,
        status: 'open',
        affectedSystems: [log.source],
        description: `Automatically created from log:\n\nMessage: ${log.message}\nIP: ${log.ip}\nUser: ${log.user || 'N/A'}\nAction: ${log.action}`,
        tags: ['auto-generated', log.severity, log.source.toLowerCase().replace(/\s+/g, '-')],
      },
    });

    console.log(`🆕 Auto-created incident: ${incident.id}`);

    // Broadcast через WebSocket
    this.eventsGateway.broadcastNewIncident(incident);

    return incident;
  }

  // Отправка внешних уведомлений
  private async sendExternalNotifications(log: any) {
    // Только для критичных и high логов
    if (log.severity !== 'critical' && log.severity !== 'high') {
      return;
    }

    // Получаем настройки уведомлений
    const settings = await this.prisma.settings.findFirst();
    
    if (!settings) return;

    // Email уведомления
    if (settings.emailNotifications) {
      await this.sendEmail('security@company.com', 'Security Alert', log);
    }

    // Slack уведомления
    if (settings.slackNotifications && settings.webhookUrl) {
      await this.sendSlack(settings.webhookUrl, 'Security Alert', log);
    }
  }

  // Отправка Email
  private async sendEmail(to: string, subject: string, log: any) {
    try {
      // TODO: Реализация с Nodemailer
      console.log(`📧 Sending email to ${to}: ${subject}`);
      
      // const nodemailer = require('nodemailer');
      // const transporter = nodemailer.createTransporter({...});
      // await transporter.sendMail({
      //   to,
      //   subject: `[SIEM] ${subject}`,
      //   html: `<h2>${log.message}</h2><p>IP: ${log.ip}</p>`
      // });
    } catch (error) {
      console.error('Failed to send email:', error);
    }
  }

  // Отправка в Slack
  private async sendSlack(webhookUrl: string, title: string, log: any) {
    try {
      console.log(`💬 Sending to Slack: ${title}`);
      
      const axios = require('axios');
      await axios.post(webhookUrl, {
        text: `🚨 *${title}*`,
        attachments: [{
          color: log.severity === 'critical' ? 'danger' : 'warning',
          fields: [
            { title: 'Message', value: log.message, short: false },
            { title: 'Severity', value: log.severity.toUpperCase(), short: true },
            { title: 'Source', value: log.source, short: true },
            { title: 'IP', value: log.ip, short: true },
            { title: 'User', value: log.user || 'N/A', short: true },
          ],
          footer: 'SIEM Light',
          ts: Math.floor(Date.now() / 1000)
        }]
      });
    } catch (error) {
      console.error('Failed to send Slack message:', error);
    }
  }

  // Отправка Webhook
  private async sendWebhook(url: string, title: string, log: any) {
    try {
      console.log(`🔗 Sending webhook to ${url}`);
      
      const axios = require('axios');
      await axios.post(url, {
        event: 'security_alert',
        title,
        log,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to send webhook:', error);
    }
  }

  // ========== Остальные методы без изменений ==========

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