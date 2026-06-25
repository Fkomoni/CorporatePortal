import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('Leadway@2026', 12);

  const user = await prisma.user.upsert({
    where: { email: 'admin@leadwayhealth.com' },
    update: {},
    create: {
      email: 'admin@leadwayhealth.com',
      password: hash,
      name: 'Favour Komoni',
      role: 'super_admin',
      companyName: 'Leadway Health',
    },
  });

  console.log('Seed complete. Admin user:', user.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
