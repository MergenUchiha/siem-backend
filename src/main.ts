import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      process.env.FRONTEND_URL??'http://localhost:5173',
    ],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false, // Отключаем whitelist чтобы не блокировать неизвестные поля
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('SIEM Light API')
    .setDescription('Security Information and Event Management API powered by NestJS, Prisma & PostgreSQL')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('logs', 'Security logs management')
    .addTag('incidents', 'Incident management')
    .addTag('analytics', 'Analytics and statistics')
    .addTag('alerts', 'Alert rules management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`
  ┌─────────────────────────────────────────────────────┐
  │                                                     │
  │   🛡️  SIEM Light Backend API (Prisma + PostgreSQL) │
  │                                                     │
  │   Server:  http://localhost:${port}                    │
  │   API:     http://localhost:${port}/api                │
  │   Docs:    http://localhost:${port}/api/docs           │
  │   DB:      PostgreSQL with Prisma ORM               │
  │                                                     │
  └─────────────────────────────────────────────────────┘
  `);
}

bootstrap();