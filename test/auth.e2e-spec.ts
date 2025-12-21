import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth API (e2e)', () => {
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
    await prisma.user.deleteMany();
  });

  describe('/api/auth/register (POST)', () => {
    it('should register a new user', () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body).toHaveProperty('token');
          expect(res.body.user.email).toBe(registerDto.email);
          expect(res.body.user.name).toBe(registerDto.name);
          expect(res.body.user).not.toHaveProperty('password');
        });
    });

    it('should not allow duplicate email registration', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      // Первая регистрация
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerDto)
        .expect(201);

      // Попытка повторной регистрации
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerDto)
        .expect(500); // Prisma unique constraint error
    });

    it('should hash the password', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerDto);

      const user = await prisma.user.findUnique({
        where: { email: registerDto.email },
      });

      expect(user!.password).not.toBe(registerDto.password);
      expect(user!.password.length).toBeGreaterThan(20); // hashed password length
    });
  });

  describe('/api/auth/login (POST)', () => {
    const testUser = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    };

    beforeEach(async () => {
      // Создаём пользователя для тестов
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser);
    });

    it('should login with correct credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body).toHaveProperty('token');
          expect(res.body.user.email).toBe(testUser.email);
        });
    });

    it('should reject invalid email', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'wrong@example.com',
          password: testUser.password,
        })
        .expect(401);
    });

    it('should reject invalid password', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('should return a valid JWT token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      expect(response.body.token).toBeTruthy();
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.split('.').length).toBe(3); // JWT format
    });
  });
});