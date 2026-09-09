import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is missing.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl,
  }),
});

async function assignOnlyRole(
  email: string,
  roleName: string,
) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    throw new Error(`Role not found: ${roleName}`);
  }

  // Remove any wrong/extra roles
  await prisma.userRole.deleteMany({
    where: {
      userId: user.id,
      roleId: {
        not: role.id,
      },
    },
  });

  // Make sure correct role exists
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id,
    },
  });

  console.log(`✅ ${email} → ${roleName}`);
}

async function main() {
  const superAdminEmail =
    process.env.INITIAL_SUPER_ADMIN_EMAIL;

  const adminEmail =
    process.env.INITIAL_ADMIN_EMAIL;

  const managerEmail =
    process.env.INITIAL_MANAGER_EMAIL;

  const employeeEmail =
    process.env.INITIAL_EMPLOYEE_EMAIL;

  if (
    !superAdminEmail ||
    !adminEmail ||
    !managerEmail ||
    !employeeEmail
  ) {
    throw new Error(
      'Workspace user emails are missing in .env',
    );
  }

  await assignOnlyRole(
    superAdminEmail.toLowerCase(),
    'SUPER_ADMIN',
  );

  await assignOnlyRole(
    adminEmail.toLowerCase(),
    'ADMIN',
  );

  await assignOnlyRole(
    managerEmail.toLowerCase(),
    'MANAGER',
  );

  await assignOnlyRole(
    employeeEmail.toLowerCase(),
    'EMPLOYEE',
  );

  console.log('');
  console.log('✅ All 4 roles cleaned successfully.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });