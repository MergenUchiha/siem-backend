import { PrismaClient } from '@prisma/client';

// Тестовый Prisma Service для изоляции тестов
export class PrismaTestService extends PrismaClient {
  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_TEST_URL || process.env.DATABASE_URL,
        },
      },
    });
  }

  async cleanDatabase() {
    // Очищаем базу данных в правильном порядке (из-за foreign keys)
    await this.alert.deleteMany();
    await this.settings.deleteMany();
    await this.incident.deleteMany();
    await this.log.deleteMany();
    await this.user.deleteMany();
  }

  async reset() {
    await this.cleanDatabase();
    await this.$disconnect();
  }
}