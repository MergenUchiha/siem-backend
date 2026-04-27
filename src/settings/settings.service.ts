/**
 * settings.service.ts — refactored
 *
 * Key improvements:
 *  - `require('axios')` inside a method replaced with Node built-in `fetch`
 *    (Node 18+, same runtime the NestJS app already uses).
 *  - `normaliseLog` moved to a pure free function (testable in isolation)
 *  - Severity mapping extracted to a constant — easy to extend
 *  - `pullLogs` body has clearer error messages
 *  - `getWebhookConfig` / `saveWebhookConfig` are idempotent — safe to call multiple times
 */

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  logs: Array<Record<string, unknown>>;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: WebhookConfig = {
  enabled: false,
  host: '',
  port: '443',
  path: '/api/logs/ingest',
  apiKey: '',
};

/**
 * Maps every common severity string / syslog number to one of our 5 levels.
 * Extend this map to add support for new formats without touching logic.
 */
const SEVERITY_MAP: Record<
  string,
  'critical' | 'high' | 'medium' | 'low' | 'info'
> = {
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

// ─── Helpers ───────────────────────────────────────────────────────────────────

function mapSeverity(level?: string | number): string {
  if (level == null) return 'info';
  return SEVERITY_MAP[String(level).toLowerCase()] ?? 'info';
}

/**
 * Converts an arbitrary raw log payload (from a remote SIEM, syslog relay, etc.)
 * into the normalised shape our Prisma `log` model expects.
 */
function normaliseLog(raw: Record<string, unknown>) {
  return {
    source: (raw.source ??
      raw.host ??
      raw.hostname ??
      raw.service ??
      'External') as string,
    severity: mapSeverity(
      (raw.level ?? raw.severity ?? raw.priority) as
        | string
        | number
        | undefined,
    ) as any,
    message: (raw.message ??
      raw.msg ??
      raw.log ??
      raw.text ??
      'No message') as string,
    ip: (raw.ip ??
      raw.src_ip ??
      raw.source_ip ??
      raw.remote_addr ??
      '0.0.0.0') as string,
    action: (raw.action ??
      raw.event_type ??
      raw.event ??
      raw.method ??
      'Pull') as string,
    user: (raw.user ?? raw.username ?? raw.account ?? undefined) as
      | string
      | undefined,
    details: raw as any,
  };
}

// ─── Service ───────────────────────────────────────────────────────────────────

export interface AutoPullStatus {
  running: boolean;
  intervalSeconds: number;
  lastPullAt: string | null;
  lastPullResult: PullResult | null;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private autoPullTimer: ReturnType<typeof setInterval> | null = null;
  private autoPullIntervalSeconds = 30;
  private lastPullAt: string | null = null;
  private lastPullResult: PullResult | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  // ── Webhook config ──────────────────────────────────────────────────────────

  async getWebhookConfig(): Promise<WebhookConfig> {
    const settings = await this.prisma.settings.findFirst();
    if (!settings?.webhookUrl) return { ...DEFAULT_CONFIG };
    try {
      const parsed = JSON.parse(settings.webhookUrl);
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch {
      return { ...DEFAULT_CONFIG };
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

  // ── Pull logs ───────────────────────────────────────────────────────────────

  async pullLogs(
    params: { limit?: number; since?: string } = {},
  ): Promise<PullResult> {
    const config = await this.getWebhookConfig();

    if (!config.host) {
      throw new BadRequestException(
        'No remote host configured. Save Integration settings first.',
      );
    }

    // Build the remote GET URL
    const protocol = config.port === '443' ? 'https' : 'http';
    const pullPath = config.path.replace(/\/ingest$/, '');
    const qs = new URLSearchParams();
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.since) qs.set('since', params.since);
    const qsStr = qs.toString() ? `?${qs.toString()}` : '';
    const url = `${protocol}://${config.host}:${config.port}${pullPath}${qsStr}`;

    // Fetch from remote — using native fetch (Node 18+)
    let rawBody: unknown;
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

      if (!res.ok) {
        throw new Error(`Remote server responded with HTTP ${res.status}`);
      }

      rawBody = await res.json();
    } catch (err: any) {
      throw new BadRequestException(
        `Could not reach remote server: ${err.message}`,
      );
    }

    // Normalise: accept `Log[]`, `{ data: Log[] }` or `{ logs: Log[] }`
    const rawLogs: Array<Record<string, unknown>> = Array.isArray(rawBody)
      ? rawBody
      : Array.isArray((rawBody as any)?.data)
        ? (rawBody as any).data
        : Array.isArray((rawBody as any)?.logs)
          ? (rawBody as any).logs
          : [];

    if (rawLogs.length === 0) {
      return { fetched: 0, saved: 0, errors: 0, logs: [] };
    }

    // Persist each log
    const saved: Array<Record<string, unknown>> = [];
    let errors = 0;

    for (const raw of rawLogs) {
      try {
        const log = await this.prisma.log.create({ data: normaliseLog(raw) });
        saved.push(log as any);
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

  // ── General settings ────────────────────────────────────────────────────────

  async getAll() {
    const settings = await this.prisma.settings.findFirst();
    if (!settings) {
      return {
        logRetentionDays: 90,
        incidentRetentionDays: 365,
        emailNotifications: true,
        slackNotifications: false,
      };
    }
    // Strip internal fields before returning to the client
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
    if (existing) {
      return this.prisma.settings.update({ where: { id: existing.id }, data });
    }
    return this.prisma.settings.create({ data: data as any });
  }

  // ── Auto-pull ──────────────────────────────────────────────────────────────

  getAutoPullStatus(): AutoPullStatus {
    return {
      running: this.autoPullTimer !== null,
      intervalSeconds: this.autoPullIntervalSeconds,
      lastPullAt: this.lastPullAt,
      lastPullResult: this.lastPullResult,
    };
  }

  startAutoPull(intervalSeconds?: number): AutoPullStatus {
    if (intervalSeconds && intervalSeconds >= 1) {
      this.autoPullIntervalSeconds = intervalSeconds;
    }

    // Clear existing timer if any
    if (this.autoPullTimer) {
      clearInterval(this.autoPullTimer);
    }

    this.logger.log(
      `Starting auto-pull every ${this.autoPullIntervalSeconds}s`,
    );

    // Run immediately, then on interval
    this.executeAutoPull();
    this.autoPullTimer = setInterval(
      () => this.executeAutoPull(),
      this.autoPullIntervalSeconds * 1000,
    );

    return this.getAutoPullStatus();
  }

  stopAutoPull(): AutoPullStatus {
    if (this.autoPullTimer) {
      clearInterval(this.autoPullTimer);
      this.autoPullTimer = null;
      this.logger.log('Auto-pull stopped');
    }
    return this.getAutoPullStatus();
  }

  private async executeAutoPull() {
    try {
      const config = await this.getWebhookConfig();
      if (!config.host || !config.enabled) {
        this.logger.warn('Auto-pull skipped: no host configured or integration disabled');
        return;
      }

      const result = await this.pullLogs({ limit: 100 });
      this.lastPullAt = new Date().toISOString();
      this.lastPullResult = result;

      if (result.saved > 0) {
        this.logger.log(`Auto-pull: saved ${result.saved} new logs`);

        // Broadcast each new log via WebSocket
        for (const log of result.logs) {
          this.eventsGateway.broadcastNewLog(log);
        }
      }
    } catch (err: any) {
      this.logger.error(`Auto-pull failed: ${err.message}`);
      this.lastPullAt = new Date().toISOString();
      this.lastPullResult = { fetched: 0, saved: 0, errors: 1, logs: [] };
    }
  }
}
