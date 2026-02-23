import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface WebhookConfig {
  enabled: boolean;
  host: string;
  port: string;
  path: string;
  apiKey: string;
}

export interface PullResult {
  fetched: number;
  saved: number;
  errors: number;
  logs: any[];
}

const DEFAULT_CONFIG: WebhookConfig = {
  enabled: false,
  host: '',
  port: '443',
  path: '/api/logs/ingest',
  apiKey: '',
};

const SEVERITY_MAP: Record<string, string> = {
  emerg: 'critical',
  emergency: 'critical',
  alert: 'critical',
  crit: 'critical',
  critical: 'critical',
  fatal: 'critical',
  severe: 'critical',
  '0': 'critical',
  '1': 'critical',
  '2': 'critical',
  err: 'high',
  error: 'high',
  high: 'high',
  '3': 'high',
  warn: 'medium',
  warning: 'medium',
  medium: 'medium',
  '4': 'medium',
  notice: 'low',
  low: 'low',
  '5': 'low',
  info: 'info',
  informational: 'info',
  debug: 'info',
  '6': 'info',
  '7': 'info',
};

function mapSeverity(level: string | number | undefined): string {
  if (level == null) return 'info';
  return SEVERITY_MAP[String(level).toLowerCase()] ?? 'info';
}

function normaliseLog(raw: any) {
  return {
    source: raw.source || raw.host || raw.hostname || raw.service || 'External',
    severity: mapSeverity(raw.level ?? raw.severity ?? raw.priority) as any,
    message: raw.message || raw.msg || raw.log || raw.text || 'No message',
    ip: raw.ip || raw.src_ip || raw.source_ip || raw.remote_addr || '0.0.0.0',
    action: raw.action || raw.event_type || raw.event || raw.method || 'Pull',
    user: raw.user || raw.username || raw.account || undefined,
    details: raw,
  };
}

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getWebhookConfig(): Promise<WebhookConfig> {
    const settings = await this.prisma.settings.findFirst();
    if (!settings?.webhookUrl) return DEFAULT_CONFIG;
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(settings.webhookUrl) };
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  async saveWebhookConfig(config: WebhookConfig): Promise<WebhookConfig> {
    const serialized = JSON.stringify(config);
    const existing = await this.prisma.settings.findFirst();
    if (existing) {
      await this.prisma.settings.update({
        where: { id: existing.id },
        data: { webhookUrl: serialized },
      });
    } else {
      await this.prisma.settings.create({
        data: {
          logRetentionDays: 90,
          incidentRetentionDays: 365,
          emailNotifications: true,
          slackNotifications: false,
          webhookUrl: serialized,
        },
      });
    }
    return config;
  }

  async pullLogs(params: {
    limit?: number;
    since?: string;
  }): Promise<PullResult> {
    const config = await this.getWebhookConfig();
    if (!config.host) {
      throw new BadRequestException(
        'No remote host configured. Save Integration settings first.',
      );
    }

    const protocol = config.port === '443' ? 'https' : 'http';
    const pullPath = config.path.replace(/\/ingest$/, '/logs');
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.since) query.set('since', params.since);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const url = `${protocol}://${config.host}:${config.port}${pullPath}${qs}`;

    let rawBody: any;
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (config.apiKey) headers['x-api-key'] = config.apiKey;
      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Remote server returned ${res.status}`);
      rawBody = await res.json();
    } catch (err: any) {
      throw new BadRequestException(
        `Could not reach remote server: ${err.message}`,
      );
    }

    const rawLogs: any[] = Array.isArray(rawBody)
      ? rawBody
      : Array.isArray(rawBody?.data)
        ? rawBody.data
        : (rawBody?.logs ?? []);

    if (!rawLogs.length) return { fetched: 0, saved: 0, errors: 0, logs: [] };

    const saved: any[] = [];
    let errors = 0;
    for (const raw of rawLogs) {
      try {
        const log = await this.prisma.log.create({ data: normaliseLog(raw) });
        saved.push(log);
      } catch {
        errors++;
      }
    }

    return {
      fetched: rawLogs.length,
      saved: saved.length,
      errors,
      logs: saved,
    };
  }

  async getAll() {
    const settings = await this.prisma.settings.findFirst();
    if (!settings)
      return {
        logRetentionDays: 90,
        incidentRetentionDays: 365,
        emailNotifications: true,
        slackNotifications: false,
      };
    const { webhookUrl: _w, id: _id, updatedAt: _u, ...rest } = settings as any;
    return rest;
  }

  async saveAll(data: {
    logRetentionDays?: number;
    incidentRetentionDays?: number;
    emailNotifications?: boolean;
    slackNotifications?: boolean;
  }) {
    const existing = await this.prisma.settings.findFirst();
    if (existing)
      return this.prisma.settings.update({ where: { id: existing.id }, data });
    return this.prisma.settings.create({ data: data as any });
  }
}
