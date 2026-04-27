import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const logger = new Logger('Bootstrap');

  // Enable CORS for frontend
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      process.env.FRONTEND_URL ?? 'http://localhost:3002',
    ],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Логирование HTTP запросов
  app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const logMessage = `${req.method} ${req.url} ${res.statusCode} - ${duration}ms`;
      
      if (res.statusCode >= 500) {
        logger.error(logMessage);
      } else if (res.statusCode >= 400) {
        logger.warn(logMessage);
      } else {
        logger.log(logMessage);
      }
    });
    
    next();
  });

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('SIEM Light API')
    .setDescription(
      'Security Information and Event Management API powered by NestJS, Prisma & PostgreSQL',
    )
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
  │   📝 HTTP Request logging is enabled                │
  │   🔍 Check console for all API requests             │
  │                                                     │
  └─────────────────────────────────────────────────────┘
  `);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
}

bootstrap();