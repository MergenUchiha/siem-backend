import { Controller, Get, Post, Body, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService, WebhookConfig } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get general settings' })
  getAll() {
    return this.settingsService.getAll();
  }

  @Post()
  @ApiOperation({ summary: 'Save general settings' })
  saveAll(@Body() data: any) {
    return this.settingsService.saveAll(data);
  }

  @Get('webhook')
  @ApiOperation({ summary: 'Get webhook integration config' })
  getWebhook() {
    return this.settingsService.getWebhookConfig();
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Save webhook integration config' })
  saveWebhook(@Body() config: WebhookConfig) {
    return this.settingsService.saveWebhookConfig(config);
  }

  @Post('webhook/pull')
  @ApiOperation({ summary: 'Pull logs from configured remote server' })
  pullLogs(@Body() body: { limit?: number; since?: string }) {
    return this.settingsService.pullLogs(body ?? {});
  }

  // ── Auto-pull endpoints ─────────────────────────────────────────────────

  @Get('auto-pull')
  @ApiOperation({ summary: 'Get auto-pull status' })
  getAutoPullStatus() {
    return this.settingsService.getAutoPullStatus();
  }

  @Post('auto-pull')
  @ApiOperation({ summary: 'Start auto-pull with optional interval (seconds)' })
  startAutoPull(@Body() body: { intervalSeconds?: number }) {
    return this.settingsService.startAutoPull(body?.intervalSeconds);
  }

  @Delete('auto-pull')
  @ApiOperation({ summary: 'Stop auto-pull' })
  stopAutoPull() {
    return this.settingsService.stopAutoPull();
  }
}
