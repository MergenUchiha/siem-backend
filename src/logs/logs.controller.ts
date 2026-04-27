import {
  Controller,
  Get,
  Post,
  Head,
  Body,
  Param,
  Query,
  Delete,
  Headers,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { LogsService } from './logs.service';
import {
  CreateLogDto,
  FilterLogDto,
  SeverityLevel,
} from './dto/create-log.dto';

@ApiTags('logs')
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new log entry' })
  @ApiResponse({ status: 201, description: 'Log created successfully' })
  create(@Body() createLogDto: CreateLogDto) {
    return this.logsService.create(createLogDto);
  }

  // SIEM проверяет соединение через HEAD /api/logs/ingest
  @Head('ingest')
  @HttpCode(200)
  @ApiOperation({ summary: 'Test ingest endpoint connectivity' })
  testIngest(@Headers('x-api-key') apiKey: string) {
    this.validateApiKey(apiKey);
  }

  @Post('ingest')
  @ApiOperation({
    summary: 'Ingest logs from external sources (requires API key)',
  })
  @ApiHeader({
    name: 'x-api-key',
    required: true,
    description: 'API Key for external log ingestion',
  })
  @ApiResponse({ status: 201, description: 'Log ingested successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  async ingestLog(@Body() logData: any, @Headers('x-api-key') apiKey: string) {
    this.validateApiKey(apiKey);

    // Определяем severity на основе всех данных лога (message, action, IP, user, комбинации)
    const severity = this.determineSeverity(logData);

    const normalizedLog: CreateLogDto = {
      source: logData.source || logData.host || logData.hostname || 'External',
      severity,
      message: logData.message || logData.msg || logData.log || 'No message',
      ip:
        logData.ip ||
        logData.src_ip ||
        logData.source_ip ||
        logData.host ||
        '0.0.0.0',
      action:
        logData.action || logData.event_type || logData.event || 'Unknown',
      user: logData.user || logData.username || logData.account,
      details: logData,
    };

    return await this.logsService.create(normalizedLog);
  }

  // SIEM проверяет pull через GET /api/logs
  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'Get all logs with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Logs retrieved successfully' })
  findAll(@Query() filterDto: FilterLogDto) {
    return this.logsService.findAll(filterDto);
  }

  @Get('sources')
  @ApiOperation({ summary: 'Get all unique log sources' })
  getSources() {
    return this.logsService.getSources();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get log statistics' })
  getStats() {
    return this.logsService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific log by ID' })
  findOne(@Param('id') id: string) {
    return this.logsService.findOne(id);
  }

  @Delete('cleanup/:days')
  @ApiOperation({ summary: 'Delete logs older than specified days' })
  deleteOld(@Param('days') days: string) {
    return this.logsService.deleteOld(parseInt(days));
  }

  private validateApiKey(apiKey: string) {
    const validApiKey =
      process.env.INGEST_API_KEY || 'siem-ingest-key-change-in-production';
    if (!apiKey || apiKey !== validApiKey) {
      throw new UnauthorizedException('Invalid or missing API key');
    }
  }

  // ============================================================
  // Определение severity: многоуровневый анализ
  // 1) Базовый маппинг по level/severity полю
  // 2) Анализ ключевых слов в message
  // 3) Анализ action
  // 4) Анализ IP-адреса (внешний/приватный)
  // 5) Комбинированные правила (несколько факторов)
  // Итоговый severity = максимальный из всех проверок
  // ============================================================

  private readonly SEVERITY_WEIGHT: Record<SeverityLevel, number> = {
    [SeverityLevel.INFO]: 0,
    [SeverityLevel.LOW]: 1,
    [SeverityLevel.MEDIUM]: 2,
    [SeverityLevel.HIGH]: 3,
    [SeverityLevel.CRITICAL]: 4,
  };

  private readonly WEIGHT_TO_SEVERITY: SeverityLevel[] = [
    SeverityLevel.INFO,
    SeverityLevel.LOW,
    SeverityLevel.MEDIUM,
    SeverityLevel.HIGH,
    SeverityLevel.CRITICAL,
  ];

  /** Главный метод: определяет severity на основе всех доступных данных лога */
  private determineSeverity(logData: any): SeverityLevel {
    const rawLevel = logData.level || logData.severity || logData.priority || 'info';
    const message = (logData.message || logData.msg || logData.log || '').toLowerCase();
    const action = (logData.action || logData.event_type || logData.event || '').toLowerCase();
    const ip = logData.ip || logData.src_ip || logData.source_ip || logData.host || '';
    const user = (logData.user || logData.username || logData.account || '').toLowerCase();

    // 1) Базовый маппинг по level
    const baseSeverity = this.mapSeverityFromLevel(rawLevel);

    // 2) По ключевым словам в message
    const messageSeverity = this.analyzeBySeverityKeywords(message);

    // 3) По action
    const actionSeverity = this.analyzeByAction(action);

    // 4) По IP
    const ipSeverity = this.analyzeByIp(ip);

    // 5) Комбинированные правила
    const comboSeverity = this.analyzeByCombo(message, action, ip, user);

    // Берём максимальный уровень из всех проверок
    const maxWeight = Math.max(
      this.SEVERITY_WEIGHT[baseSeverity],
      this.SEVERITY_WEIGHT[messageSeverity],
      this.SEVERITY_WEIGHT[actionSeverity],
      this.SEVERITY_WEIGHT[ipSeverity],
      this.SEVERITY_WEIGHT[comboSeverity],
    );

    return this.WEIGHT_TO_SEVERITY[maxWeight];
  }

  // --- 1) Базовый маппинг по level/severity/priority ---
  private mapSeverityFromLevel(level: string | number): SeverityLevel {
    if (typeof level === 'number') {
      const syslogMapping: Record<number, SeverityLevel> = {
        0: SeverityLevel.CRITICAL,
        1: SeverityLevel.CRITICAL,
        2: SeverityLevel.CRITICAL,
        3: SeverityLevel.HIGH,
        4: SeverityLevel.MEDIUM,
        5: SeverityLevel.LOW,
        6: SeverityLevel.INFO,
        7: SeverityLevel.INFO,
      };
      return syslogMapping[level] || SeverityLevel.INFO;
    }

    const levelStr = level.toString().toLowerCase();
    const mapping: Record<string, SeverityLevel> = {
      emerg: SeverityLevel.CRITICAL,
      emergency: SeverityLevel.CRITICAL,
      alert: SeverityLevel.CRITICAL,
      crit: SeverityLevel.CRITICAL,
      critical: SeverityLevel.CRITICAL,
      err: SeverityLevel.HIGH,
      error: SeverityLevel.HIGH,
      warn: SeverityLevel.MEDIUM,
      warning: SeverityLevel.MEDIUM,
      notice: SeverityLevel.LOW,
      info: SeverityLevel.INFO,
      informational: SeverityLevel.INFO,
      debug: SeverityLevel.INFO,
      fatal: SeverityLevel.CRITICAL,
      severe: SeverityLevel.CRITICAL,
      high: SeverityLevel.HIGH,
      medium: SeverityLevel.MEDIUM,
      low: SeverityLevel.LOW,
      '0': SeverityLevel.CRITICAL,
      '1': SeverityLevel.CRITICAL,
      '2': SeverityLevel.CRITICAL,
      '3': SeverityLevel.HIGH,
      '4': SeverityLevel.MEDIUM,
      '5': SeverityLevel.LOW,
      '6': SeverityLevel.INFO,
      '7': SeverityLevel.INFO,
    };

    return mapping[levelStr] || SeverityLevel.INFO;
  }

  // --- 2) Анализ ключевых слов в message ---
  private readonly MESSAGE_KEYWORDS: { pattern: RegExp; severity: SeverityLevel }[] = [
    // CRITICAL — активные атаки и критические угрозы
    { pattern: /ransomware/,               severity: SeverityLevel.CRITICAL },
    { pattern: /malware\s+(detected|found)/,severity: SeverityLevel.CRITICAL },
    { pattern: /rootkit/,                   severity: SeverityLevel.CRITICAL },
    { pattern: /backdoor/,                  severity: SeverityLevel.CRITICAL },
    { pattern: /zero[- ]?day/,              severity: SeverityLevel.CRITICAL },
    { pattern: /data\s+(breach|leak|exfiltration)/, severity: SeverityLevel.CRITICAL },
    { pattern: /privilege\s+escalation/,    severity: SeverityLevel.CRITICAL },
    { pattern: /remote\s+code\s+execution/, severity: SeverityLevel.CRITICAL },
    { pattern: /rce\s+(exploit|attack|detected)/, severity: SeverityLevel.CRITICAL },
    { pattern: /command\s+injection/,       severity: SeverityLevel.CRITICAL },
    { pattern: /unauthorized\s+root/,       severity: SeverityLevel.CRITICAL },
    { pattern: /system\s+compromised/,      severity: SeverityLevel.CRITICAL },

    // HIGH — попытки атак и подозрительная активность
    { pattern: /brute\s*force/,             severity: SeverityLevel.HIGH },
    { pattern: /sql\s*injection/,           severity: SeverityLevel.HIGH },
    { pattern: /xss\s+(attack|detected|attempt)/, severity: SeverityLevel.HIGH },
    { pattern: /cross[- ]site\s+scripting/, severity: SeverityLevel.HIGH },
    { pattern: /ddos/,                      severity: SeverityLevel.HIGH },
    { pattern: /denial\s+of\s+service/,     severity: SeverityLevel.HIGH },
    { pattern: /port\s+scan/,               severity: SeverityLevel.HIGH },
    { pattern: /unauthorized\s+access/,     severity: SeverityLevel.HIGH },
    { pattern: /authentication\s+bypass/,   severity: SeverityLevel.HIGH },
    { pattern: /directory\s+traversal/,     severity: SeverityLevel.HIGH },
    { pattern: /path\s+traversal/,          severity: SeverityLevel.HIGH },
    { pattern: /phishing/,                  severity: SeverityLevel.HIGH },
    { pattern: /credential\s+(dump|theft|stolen)/, severity: SeverityLevel.HIGH },
    { pattern: /suspicious\s+process/,      severity: SeverityLevel.HIGH },
    { pattern: /multiple\s+failed\s+login/, severity: SeverityLevel.HIGH },

    // MEDIUM — предупреждения
    { pattern: /failed\s+login/,            severity: SeverityLevel.MEDIUM },
    { pattern: /login\s+fail/,              severity: SeverityLevel.MEDIUM },
    { pattern: /access\s+denied/,           severity: SeverityLevel.MEDIUM },
    { pattern: /permission\s+denied/,       severity: SeverityLevel.MEDIUM },
    { pattern: /invalid\s+(token|certificate|credentials)/, severity: SeverityLevel.MEDIUM },
    { pattern: /suspicious\s+activity/,     severity: SeverityLevel.MEDIUM },
    { pattern: /configuration\s+change/,    severity: SeverityLevel.MEDIUM },
    { pattern: /firewall\s+block/,          severity: SeverityLevel.MEDIUM },
    { pattern: /virus\s+detected/,          severity: SeverityLevel.MEDIUM },

    // LOW — незначительные события
    { pattern: /session\s+expired/,         severity: SeverityLevel.LOW },
    { pattern: /password\s+reset/,          severity: SeverityLevel.LOW },
    { pattern: /account\s+locked/,          severity: SeverityLevel.LOW },
    { pattern: /rate\s+limit/,              severity: SeverityLevel.LOW },
  ];

  private analyzeBySeverityKeywords(message: string): SeverityLevel {
    let maxWeight = 0;
    for (const rule of this.MESSAGE_KEYWORDS) {
      if (rule.pattern.test(message)) {
        const w = this.SEVERITY_WEIGHT[rule.severity];
        if (w > maxWeight) maxWeight = w;
      }
    }
    return this.WEIGHT_TO_SEVERITY[maxWeight];
  }

  // --- 3) Анализ по action ---
  private readonly ACTION_SEVERITY: { pattern: RegExp; severity: SeverityLevel }[] = [
    // CRITICAL
    { pattern: /^(data\s+export|mass\s+delete|system\s+shutdown|wipe)$/,  severity: SeverityLevel.CRITICAL },
    { pattern: /privilege\s+escalat/,    severity: SeverityLevel.CRITICAL },
    { pattern: /root\s+login/,           severity: SeverityLevel.CRITICAL },

    // HIGH
    { pattern: /file\s+delet/,           severity: SeverityLevel.HIGH },
    { pattern: /user\s+delet/,           severity: SeverityLevel.HIGH },
    { pattern: /config(uration)?\s+(change|modif)/, severity: SeverityLevel.HIGH },
    { pattern: /firewall\s+(disable|rule\s+change)/, severity: SeverityLevel.HIGH },
    { pattern: /service\s+(stop|disable)/, severity: SeverityLevel.HIGH },

    // MEDIUM
    { pattern: /login\s+(attempt|fail)/, severity: SeverityLevel.MEDIUM },
    { pattern: /permission\s+change/,    severity: SeverityLevel.MEDIUM },
    { pattern: /role\s+change/,          severity: SeverityLevel.MEDIUM },
    { pattern: /password\s+change/,      severity: SeverityLevel.MEDIUM },

    // LOW
    { pattern: /logout/,                 severity: SeverityLevel.LOW },
    { pattern: /session\s+start/,        severity: SeverityLevel.LOW },
    { pattern: /file\s+(read|access)/,   severity: SeverityLevel.LOW },
  ];

  private analyzeByAction(action: string): SeverityLevel {
    let maxWeight = 0;
    for (const rule of this.ACTION_SEVERITY) {
      if (rule.pattern.test(action)) {
        const w = this.SEVERITY_WEIGHT[rule.severity];
        if (w > maxWeight) maxWeight = w;
      }
    }
    return this.WEIGHT_TO_SEVERITY[maxWeight];
  }

  // --- 4) Анализ по IP ---
  private readonly KNOWN_MALICIOUS_RANGES = [
    /^23\.227\.38\./,      // Известные C2 серверы
    /^185\.220\.100\./,    // Tor exit nodes (часть)
    /^185\.220\.101\./,
    /^198\.98\.56\./,
    /^45\.155\.205\./,     // Часто используемые для атак
    /^194\.26\.29\./,
    /^5\.188\.206\./,
  ];

  private isPrivateIp(ip: string): boolean {
    return (
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
      ip === '127.0.0.1' ||
      ip === '0.0.0.0' ||
      ip === '::1' ||
      ip === ''
    );
  }

  private analyzeByIp(ip: string): SeverityLevel {
    if (!ip || this.isPrivateIp(ip)) {
      return SeverityLevel.INFO;
    }

    // Проверка известных вредоносных диапазонов
    for (const range of this.KNOWN_MALICIOUS_RANGES) {
      if (range.test(ip)) {
        return SeverityLevel.CRITICAL;
      }
    }

    // Любой внешний (публичный) IP — небольшое повышение
    return SeverityLevel.LOW;
  }

  // --- 5) Комбинированные правила ---
  private analyzeByCombo(
    message: string,
    action: string,
    ip: string,
    user: string,
  ): SeverityLevel {
    const isExternal = ip && !this.isPrivateIp(ip);
    const isAdmin = /\b(admin|root|superuser|administrator|sudo)\b/.test(user);
    const isLoginFailure = /failed\s+login|login\s+fail|authentication\s+fail/.test(message)
      || /login\s+(attempt|fail)/.test(action);
    const isError = /error|err|fail/.test(message);

    // Ошибка + admin + внешний IP → CRITICAL
    if (isError && isAdmin && isExternal) {
      return SeverityLevel.CRITICAL;
    }

    // Неудачный вход + admin → HIGH
    if (isLoginFailure && isAdmin) {
      return SeverityLevel.HIGH;
    }

    // Неудачный вход + внешний IP → HIGH
    if (isLoginFailure && isExternal) {
      return SeverityLevel.HIGH;
    }

    // admin + внешний IP → MEDIUM (сам по себе подозрительно)
    if (isAdmin && isExternal) {
      return SeverityLevel.MEDIUM;
    }

    return SeverityLevel.INFO;
  }

}
