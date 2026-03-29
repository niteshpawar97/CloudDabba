import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create demo user
  const hashedPassword = await bcrypt.hash('demo1234', 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@clouddabba.com' },
    update: {},
    create: {
      name: 'Demo User',
      email: 'demo@clouddabba.com',
      password: hashedPassword,
    },
  });

  console.log(`Created user: ${user.email} (password: demo1234)`);

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

  console.log(`Created project: ${project.name} (${project.subdomain})`);

  console.log('\nSeed complete!');
  console.log('---');
  console.log('Demo login:');
  console.log('  Email:    demo@clouddabba.com');
  console.log('  Password: demo1234');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
