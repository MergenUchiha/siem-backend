import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Incidents API (e2e)', () => {
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
    await prisma.incident.deleteMany();
  });

  describe('/api/incidents (POST)', () => {
    it('should create a new incident', () => {
      const createIncidentDto = {
        title: 'Test Incident',
        severity: 'high',
        affectedSystems: ['Web Server', 'Database'],
        description: 'Test incident description',
        tags: ['test', 'security'],
      };

      return request(app.getHttpServer())
        .post('/api/incidents')
        .send(createIncidentDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.title).toBe(createIncidentDto.title);
          expect(res.body.severity).toBe(createIncidentDto.severity);
          expect(res.body.status).toBe('open');
          expect(res.body.affectedSystems).toEqual(createIncidentDto.affectedSystems);
        });
    });

    it('should validate required fields', () => {
      const invalidDto = {
        title: 'Test',
        // missing severity, affectedSystems, description
      };

      return request(app.getHttpServer())
        .post('/api/incidents')
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('/api/incidents (GET)', () => {
    beforeEach(async () => {
      await prisma.incident.createMany({
        data: [
          {
            title: 'Critical Issue',
            severity: 'critical',
            status: 'open',
            affectedSystems: ['Web Server'],
            description: 'Critical problem',
            tags: ['critical'],
          },
          {
            title: 'Medium Issue',
            severity: 'medium',
            status: 'investigating',
            affectedSystems: ['Database'],
            description: 'Medium problem',
            tags: ['medium'],
          },
          {
            title: 'Resolved Issue',
            severity: 'high',
            status: 'resolved',
            affectedSystems: ['Firewall'],
            description: 'Resolved problem',
            tags: ['resolved'],
            resolvedAt: new Date(),
          },
        ],
      });
    });

    it('should return all incidents', () => {
      return request(app.getHttpServer())
        .get('/api/incidents')
        .expect(200)
        .expect((res) => {
          expect(res.body).toBeInstanceOf(Array);
          expect(res.body.length).toBe(3);
        });
    });

    it('should filter incidents by status', () => {
      return request(app.getHttpServer())
        .get('/api/incidents?status=open')
        .expect(200)
        .expect((res) => {
          expect(res.body.length).toBe(1);
          expect(res.body[0].status).toBe('open');
        });
    });

    it('should filter incidents by severity', () => {
      return request(app.getHttpServer())
        .get('/api/incidents?severity=critical')
        .expect(200)
        .expect((res) => {
          expect(res.body.length).toBe(1);
          expect(res.body[0].severity).toBe('critical');
        });
    });
  });

  describe('/api/incidents/:id (GET)', () => {
    it('should return a specific incident', async () => {
      const incident = await prisma.incident.create({
        data: {
          title: 'Test Incident',
          severity: 'high',
          status: 'open',
          affectedSystems: ['Web Server'],
          description: 'Test',
          tags: [],
        },
      });

      return request(app.getHttpServer())
        .get(`/api/incidents/${incident.id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(incident.id);
          expect(res.body.title).toBe(incident.title);
        });
    });

    it('should return 404 for non-existent incident', () => {
      return request(app.getHttpServer())
        .get('/api/incidents/non-existent-id')
        .expect(404);
    });
  });

  describe('/api/incidents/:id (PATCH)', () => {
    it('should update an incident', async () => {
      const incident = await prisma.incident.create({
        data: {
          title: 'Test Incident',
          severity: 'high',
          status: 'open',
          affectedSystems: ['Web Server'],
          description: 'Test',
          tags: [],
        },
      });

      const updateDto = {
        status: 'resolved',
        description: 'Updated description',
      };

      return request(app.getHttpServer())
        .patch(`/api/incidents/${incident.id}`)
        .send(updateDto)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('resolved');
          expect(res.body.description).toBe('Updated description');
          expect(res.body.resolvedAt).toBeTruthy();
        });
    });

    it('should return 404 for non-existent incident', () => {
      return request(app.getHttpServer())
        .patch('/api/incidents/non-existent-id')
        .send({ status: 'resolved' })
        .expect(404);
    });
  });

  describe('/api/incidents/:id (DELETE)', () => {
    it('should delete an incident', async () => {
      const incident = await prisma.incident.create({
        data: {
          title: 'Test Incident',
          severity: 'high',
          status: 'open',
          affectedSystems: ['Web Server'],
          description: 'Test',
          tags: [],
        },
      });

      return request(app.getHttpServer())
        .delete(`/api/incidents/${incident.id}`)
        .expect(200);
    });

    it('should return 404 for non-existent incident', () => {
      return request(app.getHttpServer())
        .delete('/api/incidents/non-existent-id')
        .expect(404);
    });
  });

  describe('/api/incidents/stats (GET)', () => {
    beforeEach(async () => {
      await prisma.incident.createMany({
        data: [
          {
            title: 'Incident 1',
            severity: 'critical',
            status: 'open',
            affectedSystems: ['Web Server'],
            description: 'Test',
            tags: [],
          },
          {
            title: 'Incident 2',
            severity: 'critical',
            status: 'investigating',
            affectedSystems: ['Database'],
            description: 'Test',
            tags: [],
          },
          {
            title: 'Incident 3',
            severity: 'high',
            status: 'resolved',
            affectedSystems: ['Firewall'],
            description: 'Test',
            tags: [],
            resolvedAt: new Date(),
          },
        ],
      });
    });

    it('should return incident statistics', () => {
      return request(app.getHttpServer())
        .get('/api/incidents/stats')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('statusCounts');
          expect(res.body).toHaveProperty('severityCounts');
          expect(res.body.total).toBe(3);
          expect(res.body.severityCounts.critical).toBe(2);
        });
    });
  });
});