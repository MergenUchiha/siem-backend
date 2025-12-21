import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Logs API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Очистка базы перед каждым тестом
    await prisma.log.deleteMany();
  });

  describe('/api/logs (POST)', () => {
    it('should create a new log', () => {
      const createLogDto = {
        source: 'Web Server',
        severity: 'high',
        message: 'Test log message',
        ip: '192.168.1.1',
        action: 'Login Attempt',
      };

      return request(app.getHttpServer())
        .post('/api/logs')
        .send(createLogDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.source).toBe(createLogDto.source);
          expect(res.body.severity).toBe(createLogDto.severity);
          expect(res.body.message).toBe(createLogDto.message);
          expect(res.body.ip).toBe(createLogDto.ip);
        });
    });

    it('should validate required fields', () => {
      const invalidLogDto = {
        source: 'Web Server',
        // missing severity, message, ip, action
      };

      return request(app.getHttpServer())
        .post('/api/logs')
        .send(invalidLogDto)
        .expect(400);
    });

    it('should validate severity enum', () => {
      const invalidLogDto = {
        source: 'Web Server',
        severity: 'invalid_severity',
        message: 'Test',
        ip: '192.168.1.1',
        action: 'Test',
      };

      return request(app.getHttpServer())
        .post('/api/logs')
        .send(invalidLogDto)
        .expect(400);
    });

    it('should validate IP address format', () => {
      const invalidLogDto = {
        source: 'Web Server',
        severity: 'high',
        message: 'Test',
        ip: 'invalid-ip',
        action: 'Test',
      };

      return request(app.getHttpServer())
        .post('/api/logs')
        .send(invalidLogDto)
        .expect(400);
    });
  });

  describe('/api/logs (GET)', () => {
    beforeEach(async () => {
      // Создаём тестовые логи
      await prisma.log.createMany({
        data: [
          {
            source: 'Web Server',
            severity: 'critical',
            message: 'Critical error',
            ip: '192.168.1.1',
            action: 'Login',
          },
          {
            source: 'Database',
            severity: 'high',
            message: 'High priority',
            ip: '192.168.1.2',
            action: 'Query',
          },
          {
            source: 'Firewall',
            severity: 'medium',
            message: 'Medium alert',
            ip: '192.168.1.3',
            action: 'Block',
          },
        ],
      });
    });

    it('should return all logs with pagination', () => {
      return request(app.getHttpServer())
        .get('/api/logs')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('page');
          expect(res.body).toHaveProperty('limit');
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.total).toBe(3);
        });
    });

    it('should filter logs by severity', () => {
      return request(app.getHttpServer())
        .get('/api/logs?severity=critical')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.data.length).toBe(1);
          expect(res.body.data[0].severity).toBe('critical');
        });
    });

    it('should filter logs by source', () => {
      return request(app.getHttpServer())
        .get('/api/logs?source=Database')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBe(1);
          expect(res.body.data[0].source).toBe('Database');
        });
    });

    it('should search logs by text', () => {
      return request(app.getHttpServer())
        .get('/api/logs?search=critical')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBeGreaterThan(0);
          expect(res.body.data[0].message).toContain('Critical');
        });
    });

    it('should paginate results', () => {
      return request(app.getHttpServer())
        .get('/api/logs?page=1&limit=2')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBe(2);
          expect(res.body.page).toBe(1);
          expect(res.body.limit).toBe(2);
          expect(res.body.totalPages).toBe(2);
        });
    });
  });

  describe('/api/logs/sources (GET)', () => {
    beforeEach(async () => {
      await prisma.log.createMany({
        data: [
          {
            source: 'Web Server',
            severity: 'high',
            message: 'Test',
            ip: '192.168.1.1',
            action: 'Test',
          },
          {
            source: 'Database',
            severity: 'high',
            message: 'Test',
            ip: '192.168.1.2',
            action: 'Test',
          },
          {
            source: 'Web Server',
            severity: 'high',
            message: 'Test',
            ip: '192.168.1.3',
            action: 'Test',
          },
        ],
      });
    });

    it('should return unique log sources', () => {
      return request(app.getHttpServer())
        .get('/api/logs/sources')
        .expect(200)
        .expect((res) => {
          expect(res.body).toBeInstanceOf(Array);
          expect(res.body.length).toBe(2);
          expect(res.body).toContain('Web Server');
          expect(res.body).toContain('Database');
        });
    });
  });

  describe('/api/logs/stats (GET)', () => {
    beforeEach(async () => {
      await prisma.log.createMany({
        data: [
          {
            source: 'Web Server',
            severity: 'critical',
            message: 'Test',
            ip: '192.168.1.1',
            action: 'Test',
          },
          {
            source: 'Database',
            severity: 'critical',
            message: 'Test',
            ip: '192.168.1.2',
            action: 'Test',
          },
          {
            source: 'Firewall',
            severity: 'high',
            message: 'Test',
            ip: '192.168.1.3',
            action: 'Test',
          },
        ],
      });
    });

    it('should return log statistics', () => {
      return request(app.getHttpServer())
        .get('/api/logs/stats')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('severityCounts');
          expect(res.body.total).toBe(3);
          expect(res.body.severityCounts).toHaveProperty('critical');
          expect(res.body.severityCounts.critical).toBe(2);
        });
    });
  });

  describe('/api/logs/:id (GET)', () => {
    it('should return a specific log', async () => {
      const log = await prisma.log.create({
        data: {
          source: 'Web Server',
          severity: 'high',
          message: 'Test log',
          ip: '192.168.1.1',
          action: 'Login',
        },
      });

      return request(app.getHttpServer())
        .get(`/api/logs/${log.id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(log.id);
          expect(res.body.source).toBe(log.source);
        });
    });

    it('should return null for non-existent log', () => {
      return request(app.getHttpServer())
        .get('/api/logs/non-existent-id')
        .expect(200)
        .expect((res) => {
          expect(res.body).toBeNull();
        });
    });
  });
});