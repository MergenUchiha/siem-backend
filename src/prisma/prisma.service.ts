import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    console.log('✅ Connected to PostgreSQL database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('❌ Disconnected from PostgreSQL database');
  }

  async cleanDatabase() {
    // Utility method for testing
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production!');
    }

    const models = Reflect.ownKeys(this).filter(
      (key) => typeof key === 'string' && key[0] !== '_'
    );

    return Promise.all(
      models.map((modelKey) => {
        return (this as any)[modelKey].deleteMany();
      })
    );
  }
}