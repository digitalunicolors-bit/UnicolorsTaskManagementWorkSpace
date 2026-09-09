import 'dotenv/config';
import { hash } from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

const databaseUrl = getRequiredEnv('DATABASE_URL');
const email = getRequiredEnv(
  'INITIAL_SUPER_ADMIN_EMAIL',
).toLowerCase();
const phone = getRequiredEnv(
  'INITIAL_SUPER_ADMIN_PHONE',
);
const password = getRequiredEnv(
  'INITIAL_SUPER_ADMIN_PASSWORD',
);

const fullName =
  process.env.INITIAL_SUPER_ADMIN_NAME?.trim() ||
  'Super Admin';

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log('Creating initial Super Admin...');

  const superAdminRole =
    await prisma.role.findUnique({
      where: {
        name: 'SUPER_ADMIN',
      },
    });

  if (!superAdminRole) {
    throw new Error(
      'SUPER_ADMIN role not found. Run prisma/seed.ts first.',
    );
  }

  const passwordHash = await hash(password, 12);

  const user = await prisma.user.upsert({
    where: {
      email,
    },

    update: {
      phone,
      passwordHash,
      isActive: true,
      mustChangePassword: false,
      deletedAt: null,
    },

    create: {
      email,
      phone,
      passwordHash,
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: superAdminRole.id,
      },
    },

    update: {},

    create: {
      userId: user.id,
      roleId: superAdminRole.id,
    },
  });

  await prisma.employeeProfile.upsert({
    where: {
      userId: user.id,
    },

    update: {
      fullName,
      designation: 'Super Admin',
      employmentStatus: 'ACTIVE',
      deletedAt: null,
    },

    create: {
      userId: user.id,
      employeeId: 'UC-SA-001',
      fullName,
      designation: 'Super Admin',
      employmentStatus: 'ACTIVE',
    },
  });

  console.log(
    '✅ Initial Super Admin created successfully.',
  );
  console.log(`Email: ${email}`);
  console.log(`Phone: ${phone}`);
}

main()
  .catch((error: unknown) => {
    console.error(
      '❌ Super Admin creation failed.',
    );
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
