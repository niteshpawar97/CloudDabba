import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Skip seed if setup wizard already completed
  try {
    const settings = await (prisma as any).platformSettings.findUnique({ where: { id: 'singleton' } });
    if (settings?.setupCompleted) {
      console.log('Setup already completed — skipping seed.');
      return;
    }
  } catch {}

  console.log('Seeding database...');

  const adminPassword = await bcrypt.hash('admin@123', 12);
  const demoPassword = await bcrypt.hash('demo1234', 12);

  // Create admin user
  const admin = await (prisma.user.upsert as any)({
    where: { email: 'admin@clouddabba.dev' },
    update: { role: 'admin' },
    create: {
      name: 'Admin',
      email: 'admin@clouddabba.dev',
      password: adminPassword,
      role: 'admin',
    },
  });
  console.log(`Admin: ${admin.email} (password: admin@123)`);

  // Create demo user
  const user = await (prisma.user.upsert as any)({
    where: { email: 'demo@clouddabba.dev' },
    update: {},
    create: {
      name: 'Demo User',
      email: 'demo@clouddabba.dev',
      password: demoPassword,
      role: 'user',
    },
  });
  console.log(`User:  ${user.email} (password: demo1234)`);

  // Create sample project
  const project = await prisma.project.upsert({
    where: { subdomain: 'demo-app' },
    update: {},
    create: {
      userId: user.id,
      name: 'demo-app',
      repoUrl: 'https://github.com/expressjs/express.git',
      subdomain: 'demo-app',
      projectType: 'NODE_BACKEND' as any,
      status: 'INACTIVE' as any,
      branch: 'main',
    },
  });
  console.log(`Project: ${project.name} (${project.subdomain})`);

  console.log('\n=============================');
  console.log('  Seed complete!');
  console.log('=============================');
  console.log('');
  console.log('  Admin Panel:');
  console.log('    URL:      /admin');
  console.log('    Email:    admin@clouddabba.dev');
  console.log('    Password: admin@123');
  console.log('');
  console.log('  User Panel:');
  console.log('    URL:      /dashboard');
  console.log('    Email:    demo@clouddabba.dev');
  console.log('    Password: demo1234');
  console.log('');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
