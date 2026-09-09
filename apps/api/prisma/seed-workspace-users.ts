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

const databaseUrl =
  getRequiredEnv('DATABASE_URL');

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

type WorkspaceRole =
  | 'ADMIN'
  | 'MANAGER'
  | 'EMPLOYEE';

type CreateWorkspaceUserOptions = {
  roleName: WorkspaceRole;
  email: string;
  phone: string;
  password: string;
  fullName: string;
  employeeIdPrefix: string;
  designation: string;
  reportingManagerId?: string | null;
};

async function getNextEmployeeId(
  prefix: string,
) {
  for (let number = 1; number <= 999; number++) {
    const employeeId =
      `${prefix}-${String(number).padStart(3, '0')}`;

    const existing =
      await prisma.employeeProfile.findUnique({
        where: {
          employeeId,
        },
        select: {
          id: true,
        },
      });

    if (!existing) {
      return employeeId;
    }
  }

  throw new Error(
    `No available employee ID found for ${prefix}.`,
  );
}

async function createWorkspaceUser({
  roleName,
  email,
  phone,
  password,
  fullName,
  employeeIdPrefix,
  designation,
  reportingManagerId = null,
}: CreateWorkspaceUserOptions) {
  const role =
    await prisma.role.findUnique({
      where: {
        name: roleName,
      },
    });

  if (!role) {
    throw new Error(
      `${roleName} role not found. Run prisma/seed.ts first.`,
    );
  }

  const passwordHash =
    await hash(password, 12);

  const user =
    await prisma.user.upsert({
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
        roleId: role.id,
      },
    },

    update: {},

    create: {
      userId: user.id,
      roleId: role.id,
    },
  });

  const existingProfile =
    await prisma.employeeProfile.findUnique({
      where: {
        userId: user.id,
      },
    });

  if (existingProfile) {
    const updatedProfile =
      await prisma.employeeProfile.update({
        where: {
          id: existingProfile.id,
        },

        data: {
          fullName,
          designation,
          reportingManagerId,
          employmentStatus: 'ACTIVE',
          deletedAt: null,
        },
      });

    console.log(
      `✅ ${roleName} updated: ${email} (${updatedProfile.employeeId})`,
    );

    return updatedProfile;
  }

  const employeeId =
    await getNextEmployeeId(
      employeeIdPrefix,
    );

  const employeeProfile =
    await prisma.employeeProfile.create({
      data: {
        userId: user.id,
        employeeId,
        fullName,
        designation,
        reportingManagerId,
        employmentStatus: 'ACTIVE',
      },
    });

  console.log(
    `✅ ${roleName} created: ${email} (${employeeId})`,
  );

  return employeeProfile;
}

async function main() {
  console.log(
    'Creating workspace users...',
  );

  const admin =
    await createWorkspaceUser({
      roleName: 'ADMIN',

      email: getRequiredEnv(
        'INITIAL_ADMIN_EMAIL',
      ),

      phone: getRequiredEnv(
        'INITIAL_ADMIN_PHONE',
      ),

      password: getRequiredEnv(
        'INITIAL_ADMIN_PASSWORD',
      ),

      fullName:
        process.env.INITIAL_ADMIN_NAME?.trim() ||
        'Workspace Admin',

      employeeIdPrefix: 'UC-ADM',

      designation:
        'Administrator',
    });

  console.log(
    `Admin profile: ${admin.id}`,
  );

  const manager =
    await createWorkspaceUser({
      roleName: 'MANAGER',

      email: getRequiredEnv(
        'INITIAL_MANAGER_EMAIL',
      ),

      phone: getRequiredEnv(
        'INITIAL_MANAGER_PHONE',
      ),

      password: getRequiredEnv(
        'INITIAL_MANAGER_PASSWORD',
      ),

      fullName:
        process.env.INITIAL_MANAGER_NAME?.trim() ||
        'Workspace Manager',

      employeeIdPrefix: 'UC-MGR',

      designation:
        'Manager',
    });

  await createWorkspaceUser({
    roleName: 'EMPLOYEE',

    email: getRequiredEnv(
      'INITIAL_EMPLOYEE_EMAIL',
    ),

    phone: getRequiredEnv(
      'INITIAL_EMPLOYEE_PHONE',
    ),

    password: getRequiredEnv(
      'INITIAL_EMPLOYEE_PASSWORD',
    ),

    fullName:
      process.env.INITIAL_EMPLOYEE_NAME?.trim() ||
      'Workspace Employee',

    employeeIdPrefix: 'UC-EMP',

    designation:
      'Employee',

    reportingManagerId:
      manager.id,
  });

  console.log('');
  console.log(
    '✅ ADMIN, MANAGER and EMPLOYEE are ready.',
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });