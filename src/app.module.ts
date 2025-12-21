import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { LogsModule } from './logs/logs.module';
import { IncidentsModule } from './incidents/incidents.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AlertsModule } from './alerts/alerts.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    // Environment variables
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Prisma database
    PrismaModule,
    // Feature modules
    AuthModule,
    LogsModule,
    IncidentsModule,
    AnalyticsModule,
    AlertsModule,
    EventsModule,
  ],
})
export class AppModule {}