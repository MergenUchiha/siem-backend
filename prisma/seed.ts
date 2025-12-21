import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create default admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@siem.local' },
    update: {},
    create: {
      email: 'admin@siem.local',
      password: hashedPassword,
      name: 'Admin User',
      role: 'admin',
    },
  });

  console.log('✅ Created admin user:', admin.email);

  // Create sample logs
  const sources = ['Web Server', 'Database', 'Firewall', 'VPN Gateway', 'Email Server', 'API Gateway'];
  const actions = ['Login Attempt', 'File Access', 'Network Connection', 'Authentication', 'Data Transfer'];
  const severities = ['critical', 'high', 'medium', 'low', 'info'];
  const messages = [
    'Multiple failed login attempts detected',
    'Suspicious file download activity',
    'Unauthorized access attempt blocked',
    'Port scan detected from external IP',
    'Database query execution time exceeded threshold',
  ];

  for (let i = 0; i < 50; i++) {
    await prisma.log.create({
      data: {
        source: sources[Math.floor(Math.random() * sources.length)],
        severity: severities[Math.floor(Math.random() * severities.length)] as any,
        message: messages[Math.floor(Math.random() * messages.length)],
        ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        user: Math.random() > 0.5 ? `user${Math.floor(Math.random() * 100)}` : null,
        action: actions[Math.floor(Math.random() * actions.length)],
        timestamp: new Date(Date.now() - Math.random() * 86400000),
      },
    });
  }

  console.log('✅ Created 50 sample logs');

  // Create sample incidents
  await prisma.incident.createMany({
    data: [
      {
        title: 'Brute Force Attack on Admin Panel',
        severity: 'critical',
        status: 'investigating',
        affectedSystems: ['Web Server', 'Authentication Service'],
        description: 'Multiple failed login attempts from various IPs targeting admin accounts',
        tags: ['brute-force', 'authentication'],
        timestamp: new Date(Date.now() - 1800000),
      },
      {
        title: 'Suspicious Data Exfiltration',
        severity: 'high',
        status: 'open',
        affectedSystems: ['Database', 'API Gateway'],
        description: 'Unusual volume of data transfers detected to external IP addresses',
        tags: ['data-leak', 'database'],
        timestamp: new Date(Date.now() - 3600000),
      },
      {
        title: 'SQL Injection Attempt',
        severity: 'high',
        status: 'investigating',
        affectedSystems: ['Database'],
        description: 'Malicious SQL queries detected in API requests',
        tags: ['sql-injection', 'web'],
        timestamp: new Date(Date.now() - 7200000),
      },
      {
        title: 'Unauthorized Configuration Change',
        severity: 'medium',
        status: 'resolved',
        affectedSystems: ['Firewall'],
        description: 'Firewall rules modified without proper authorization',
        tags: ['configuration', 'firewall'],
        timestamp: new Date(Date.now() - 10800000),
        resolvedAt: new Date(Date.now() - 3600000),
      },
    ],
  });

  console.log('✅ Created 4 sample incidents');

  // Create sample alert rules
  await prisma.alert.createMany({
    data: [
      {
        name: 'Multiple Failed Login Attempts',
        description: 'Trigger when more than 5 failed login attempts within 10 minutes',
        severity: 'high',
        enabled: true,
        condition: JSON.stringify({ field: 'action', operator: 'equals', value: 'Login Attempt', count: 5, timeWindow: 600 }),
        action: JSON.stringify({ type: 'email', target: 'security@company.com' }),
      },
      {
        name: 'Critical Severity Events',
        description: 'Alert on any critical severity event',
        severity: 'critical',
        enabled: true,
        condition: JSON.stringify({ field: 'severity', operator: 'equals', value: 'critical' }),
        action: JSON.stringify({ type: 'slack', target: '#security-alerts' }),
      },
    ],
  });

  console.log('✅ Created 2 sample alert rules');

  // Create settings
  await prisma.settings.create({
    data: {
      logRetentionDays: 90,
      incidentRetentionDays: 365,
      emailNotifications: true,
      slackNotifications: false,
    },
  });

  console.log('✅ Created default settings');

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });