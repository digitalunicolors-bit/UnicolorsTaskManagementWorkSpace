import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

function required(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

const adapter = new PrismaPg({
  connectionString: required('DATABASE_URL'),
});

const prisma = new PrismaClient({
  adapter,
});

async function setSingleRole(
  email: string,
  roleName:
    | 'SUPER_ADMIN'
    | 'ADMIN'
    | 'MANAGER'
    | 'EMPLOYEE',
) {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },

    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error(
      `User not found: ${email}`,
    );
  }

  const role = await prisma.role.findUnique({
    where: {
      name: roleName,
    },
  });

  if (!role) {
    throw new Error(
      `Role not found: ${roleName}`,
    );
  }

  await prisma.userRole.deleteMany({
    where: {
      userId: user.id,
      roleId: {
        not: role.id,
      },
    },
  });

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

  console.log(
    `✅ ${email} → ${roleName}`,
  );
}

async function main() {
  await setSingleRole(
    required('INITIAL_SUPER_ADMIN_EMAIL'),
    'SUPER_ADMIN',
  );

  await setSingleRole(
    required('INITIAL_ADMIN_EMAIL'),
    'ADMIN',
  );

  await setSingleRole(
    required('INITIAL_MANAGER_EMAIL'),
    'MANAGER',
  );

  await setSingleRole(
    required('INITIAL_EMPLOYEE_EMAIL'),
    'EMPLOYEE',
  );

  console.log('');
  console.log(
    '✅ All four workspace roles normalized.',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });