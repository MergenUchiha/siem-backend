import { Controller, Get, Post, Body } from '@nestjs/common';
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
}
