import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
console.log('Prisma models:', Object.keys(prisma).filter(k => !k.startsWith('$')));
prisma.$connect().then(() => {
  console.log('Connected');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
