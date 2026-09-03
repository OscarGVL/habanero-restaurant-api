import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash('StaffPassword123!', 10);

  const staff = await prisma.customer.upsert({
    where: {
      email: 'staff@habanero.local',
    },
    update: {
      role: 'STAFF',
      passwordHash,
    },
    create: {
      name: 'Habanero Staff',
      email: 'staff@habanero.local',
      passwordHash,
      role: 'STAFF',
    },
  });

  console.log(`Staff user ready: ${staff.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
