import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  Prisma,
  PrismaClient,
} from '../src/generated/prisma/client';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not configured.');
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

const permissions = [
  {
    code: 'dashboard.view',
    name: 'View Dashboard',
    module: 'dashboard',
  },

  {
    code: 'employees.view',
    name: 'View Employees',
    module: 'employees',
  },
  {
    code: 'employees.manage',
    name: 'Manage Employees',
    module: 'employees',
  },

  {
    code: 'departments.view',
    name: 'View Departments',
    module: 'departments',
  },
  {
    code: 'departments.manage',
    name: 'Manage Departments',
    module: 'departments',
  },

  {
    code: 'teams.view',
    name: 'View Teams',
    module: 'teams',
  },
  {
    code: 'teams.manage',
    name: 'Manage Teams',
    module: 'teams',
  },

  {
    code: 'roles.view',
    name: 'View Roles and Permissions',
    module: 'roles',
  },
  {
    code: 'roles.manage',
    name: 'Manage Roles and Permissions',
    module: 'roles',
  },

  {
    code: 'clients.view',
    name: 'View Clients',
    module: 'clients',
  },
  {
    code: 'clients.manage',
    name: 'Manage Clients',
    module: 'clients',
  },

  {
    code: 'projects.view',
    name: 'View Projects',
    module: 'projects',
  },
  {
    code: 'projects.manage',
    name: 'Manage Projects',
    module: 'projects',
  },

  {
    code: 'tasks.view',
    name: 'View Permitted Tasks',
    module: 'tasks',
  },
  {
    code: 'tasks.view_all',
    name: 'View All Tasks',
    module: 'tasks',
  },
  {
    code: 'tasks.create',
    name: 'Create Tasks',
    module: 'tasks',
  },
  {
    code: 'tasks.update',
    name: 'Update Tasks',
    module: 'tasks',
  },
  {
    code: 'tasks.assign',
    name: 'Assign Tasks',
    module: 'tasks',
  },
  {
    code: 'tasks.review',
    name: 'Review Tasks',
    module: 'tasks',
  },
  {
    code: 'tasks.approve',
    name: 'Approve Tasks',
    module: 'tasks',
  },
  {
    code: 'tasks.cancel',
    name: 'Cancel Tasks',
    module: 'tasks',
  },
  {
    code: 'tasks.delete',
    name: 'Delete Tasks',
    module: 'tasks',
  },
  {
    code: 'tasks.critical.create',
    name: 'Create Critical Tasks',
    module: 'tasks',
  },

  {
    code: 'comments.create',
    name: 'Add Comments',
    module: 'comments',
  },
  {
    code: 'comments.manage',
    name: 'Manage Comments',
    module: 'comments',
  },

  {
    code: 'files.upload',
    name: 'Upload Files',
    module: 'files',
  },
  {
    code: 'files.download',
    name: 'Download Files',
    module: 'files',
  },
  {
    code: 'files.manage',
    name: 'Manage Files',
    module: 'files',
  },

  {
    code: 'time.manage_own',
    name: 'Manage Own Time Entries',
    module: 'time',
  },
  {
    code: 'time.view_all',
    name: 'View All Time Entries',
    module: 'time',
  },

  {
    code: 'reports.view',
    name: 'View Reports',
    module: 'reports',
  },
  {
    code: 'reports.export',
    name: 'Export Reports',
    module: 'reports',
  },

  {
    code: 'notifications.manage',
    name: 'Manage Notification Rules',
    module: 'notifications',
  },

  {
    code: 'workflow.manage',
    name: 'Manage Task Workflow',
    module: 'workflow',
  },

  {
    code: 'activity_logs.view',
    name: 'View Activity Logs',
    module: 'activity_logs',
  },

  {
    code: 'login_history.view',
    name: 'View Login History',
    module: 'security',
  },

  {
    code: 'settings.view',
    name: 'View System Settings',
    module: 'settings',
  },
  {
    code: 'settings.manage',
    name: 'Manage System Settings',
    module: 'settings',
  },
];

const roles = [
  {
    name: 'SUPER_ADMIN',
    description: 'Complete system access.',
    isSystem: true,
  },
  {
    name: 'ADMIN',
    description: 'Administrative access for operations and task management.',
    isSystem: true,
  },
  {
    name: 'MANAGER',
    description: 'Manager or Team Leader access.',
    isSystem: true,
  },
  {
    name: 'EMPLOYEE',
    description: 'Employee access to assigned and permitted work.',
    isSystem: true,
  },
  {
    name: 'VIEWER',
    description: 'Read-only access to permitted information.',
    isSystem: true,
  },
];

const rolePermissionCodes: Record<string, string[]> = {
  SUPER_ADMIN: permissions.map((permission) => permission.code),

  ADMIN: [
    'dashboard.view',
    'employees.view',
    'employees.manage',
    'departments.view',
    'teams.view',

    'clients.view',
    'clients.manage',

    'projects.view',
    'projects.manage',

    'tasks.view',
    'tasks.view_all',
    'tasks.create',
    'tasks.update',
    'tasks.assign',
    'tasks.review',
    'tasks.approve',
    'tasks.cancel',
    'tasks.delete',
    'tasks.critical.create',

    'comments.create',
    'comments.manage',

    'files.upload',
    'files.download',
    'files.manage',

    'time.manage_own',
    'time.view_all',

    'reports.view',
    'reports.export',

    'activity_logs.view',
  ],

  MANAGER: [
    'dashboard.view',

    'employees.view',
    'departments.view',
    'teams.view',

    'clients.view',
    'projects.view',
    'projects.manage',

    'tasks.view',
    'tasks.create',
    'tasks.update',
    'tasks.assign',
    'tasks.review',
    'tasks.approve',

    'comments.create',

    'files.upload',
    'files.download',

    'time.manage_own',
    'time.view_all',

    'reports.view',
  ],

  EMPLOYEE: [
    'dashboard.view',

    'clients.view',
    'projects.view',

    'tasks.view',
    'tasks.update',

    'comments.create',

    'files.upload',
    'files.download',

    'time.manage_own',
  ],

  VIEWER: [
    'dashboard.view',
    'clients.view',
    'projects.view',
    'tasks.view',
    'files.download',
    'reports.view',
  ],
};

const taskStatuses = [
  {
    code: 'TO_DO',
    name: 'To Do',
    sortOrder: 10,
  },
  {
    code: 'IN_PROGRESS',
    name: 'In Progress',
    sortOrder: 20,
  },
  {
    code: 'REVIEW',
    name: 'Review',
    sortOrder: 30,
  },
  {
    code: 'INTERNAL_REVIEW',
    name: 'Internal Review',
    sortOrder: 40,
  },
  {
    code: 'CLIENT_REVIEW',
    name: 'Client Review',
    sortOrder: 50,
  },
  {
    code: 'CORRECTION',
    name: 'Correction',
    sortOrder: 60,
  },
  {
    code: 'CHANGES_REQUESTED',
    name: 'Changes Requested',
    sortOrder: 70,
  },
  {
    code: 'ON_HOLD',
    name: 'On Hold',
    sortOrder: 80,
  },
  {
    code: 'DONE',
    name: 'Done',
    sortOrder: 90,
  },
  {
    code: 'CANCELLED',
    name: 'Cancelled',
    sortOrder: 100,
  },
  {
    code: 'ARCHIVED',
    name: 'Archived',
    sortOrder: 110,
  },
];

const workflowTransitions = [
  {
    from: 'TO_DO',
    to: 'IN_PROGRESS',
    permission: 'tasks.update',
    requiresApproval: false,
  },
  {
    from: 'IN_PROGRESS',
    to: 'REVIEW',
    permission: 'tasks.update',
    requiresApproval: false,
  },
  {
    from: 'REVIEW',
    to: 'INTERNAL_REVIEW',
    permission: 'tasks.review',
    requiresApproval: true,
  },
  {
    from: 'INTERNAL_REVIEW',
    to: 'CLIENT_REVIEW',
    permission: 'tasks.approve',
    requiresApproval: true,
  },
  {
    from: 'CLIENT_REVIEW',
    to: 'CORRECTION',
    permission: 'tasks.review',
    requiresApproval: true,
  },
  {
    from: 'CORRECTION',
    to: 'REVIEW',
    permission: 'tasks.update',
    requiresApproval: false,
  },
  {
    from: 'REVIEW',
    to: 'DONE',
    permission: 'tasks.approve',
    requiresApproval: true,
  },
  {
    from: 'CLIENT_REVIEW',
    to: 'DONE',
    permission: 'tasks.approve',
    requiresApproval: true,
  },

  {
    from: 'REVIEW',
    to: 'CHANGES_REQUESTED',
    permission: 'tasks.review',
    requiresApproval: true,
  },
  {
    from: 'INTERNAL_REVIEW',
    to: 'CHANGES_REQUESTED',
    permission: 'tasks.review',
    requiresApproval: true,
  },
  {
    from: 'CLIENT_REVIEW',
    to: 'CHANGES_REQUESTED',
    permission: 'tasks.review',
    requiresApproval: true,
  },
  {
    from: 'CHANGES_REQUESTED',
    to: 'IN_PROGRESS',
    permission: 'tasks.update',
    requiresApproval: false,
  },

  {
    from: 'TO_DO',
    to: 'ON_HOLD',
    permission: 'tasks.update',
    requiresApproval: false,
  },
  {
    from: 'IN_PROGRESS',
    to: 'ON_HOLD',
    permission: 'tasks.update',
    requiresApproval: false,
  },
  {
    from: 'REVIEW',
    to: 'ON_HOLD',
    permission: 'tasks.review',
    requiresApproval: false,
  },
  {
    from: 'ON_HOLD',
    to: 'IN_PROGRESS',
    permission: 'tasks.update',
    requiresApproval: false,
  },

  {
    from: 'TO_DO',
    to: 'CANCELLED',
    permission: 'tasks.cancel',
    requiresApproval: false,
  },
  {
    from: 'IN_PROGRESS',
    to: 'CANCELLED',
    permission: 'tasks.cancel',
    requiresApproval: false,
  },

  {
    from: 'DONE',
    to: 'ARCHIVED',
    permission: 'tasks.update',
    requiresApproval: false,
  },
  {
    from: 'CANCELLED',
    to: 'ARCHIVED',
    permission: 'tasks.update',
    requiresApproval: false,
  },
];

const systemSettings: Array<{
  key: string;
  value: Prisma.InputJsonValue;
  category: string;
  description: string;
  isPublic?: boolean;
}> = [
  {
    key: 'app.timezone',
    value: 'Asia/Kolkata',
    category: 'application',
    description: 'Default application timezone.',
  },
  {
    key: 'notifications.dailyReminderTime',
    value: '09:00',
    category: 'notifications',
    description: 'Default morning task reminder time.',
  },
  {
    key: 'notifications.dailyWhatsappReminderEnabled',
    value: true,
    category: 'notifications',
    description: 'Enable daily WhatsApp task digest.',
  },
  {
    key: 'auth.maxFailedLoginAttempts',
    value: 5,
    category: 'authentication',
    description: 'Maximum failed login attempts before account lockout.',
  },
  {
    key: 'auth.lockoutMinutes',
    value: 30,
    category: 'authentication',
    description: 'Default account lockout duration in minutes.',
  },
  {
    key: 'files.maxUploadSizeMb',
    value: 25,
    category: 'files',
    description: 'Default maximum file upload size.',
  },
];

async function seedPermissions() {
  console.log('Seeding permissions...');

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        code: permission.code,
      },
      update: {
        name: permission.name,
        module: permission.module,
      },
      create: {
        code: permission.code,
        name: permission.name,
        module: permission.module,
      },
    });
  }
}

async function seedRoles() {
  console.log('Seeding roles...');

  for (const roleData of roles) {
    await prisma.role.upsert({
      where: {
        name: roleData.name,
      },
      update: {
        description: roleData.description,
        isSystem: roleData.isSystem,
        isActive: true,
      },
      create: {
        name: roleData.name,
        description: roleData.description,
        isSystem: roleData.isSystem,
        isActive: true,
      },
    });
  }
}

async function seedRolePermissions() {
  console.log('Assigning permissions to roles...');

  const databaseRoles = await prisma.role.findMany();
  const databasePermissions = await prisma.permission.findMany();

  const roleMap = new Map(
    databaseRoles.map((role) => [role.name, role]),
  );

  const permissionMap = new Map(
    databasePermissions.map((permission) => [
      permission.code,
      permission,
    ]),
  );

  for (const [roleName, permissionCodes] of Object.entries(
    rolePermissionCodes,
  )) {
    const role = roleMap.get(roleName);

    if (!role) {
      throw new Error(`Role not found: ${roleName}`);
    }

    for (const permissionCode of permissionCodes) {
      const permission = permissionMap.get(permissionCode);

      if (!permission) {
        throw new Error(
          `Permission not found: ${permissionCode}`,
        );
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }
}

async function seedTaskStatuses() {
  console.log('Seeding task statuses...');

  for (const status of taskStatuses) {
    await prisma.taskStatus.upsert({
      where: {
        code: status.code,
      },
      update: {
        name: status.name,
        sortOrder: status.sortOrder,
        isSystem: true,
        isActive: true,
      },
      create: {
        code: status.code,
        name: status.name,
        sortOrder: status.sortOrder,
        isSystem: true,
        isActive: true,
      },
    });
  }
}

async function seedWorkflowTransitions() {
  console.log('Seeding workflow transitions...');

  const statuses = await prisma.taskStatus.findMany();
  const databasePermissions =
    await prisma.permission.findMany();

  const statusMap = new Map(
    statuses.map((status) => [status.code, status]),
  );

  const permissionMap = new Map(
    databasePermissions.map((permission) => [
      permission.code,
      permission,
    ]),
  );

  for (let index = 0; index < workflowTransitions.length; index++) {
    const transition = workflowTransitions[index];

    const fromStatus = statusMap.get(transition.from);
    const toStatus = statusMap.get(transition.to);
    const permission = permissionMap.get(
      transition.permission,
    );

    if (!fromStatus || !toStatus) {
      throw new Error(
        `Workflow status missing: ${transition.from} -> ${transition.to}`,
      );
    }

    if (!permission) {
      throw new Error(
        `Workflow permission missing: ${transition.permission}`,
      );
    }

    await prisma.taskWorkflowTransition.upsert({
      where: {
        fromStatusId_toStatusId: {
          fromStatusId: fromStatus.id,
          toStatusId: toStatus.id,
        },
      },
      update: {
        requiredPermissionId: permission.id,
        requiresApproval: transition.requiresApproval,
        isActive: true,
        sortOrder: index + 1,
      },
      create: {
        fromStatusId: fromStatus.id,
        toStatusId: toStatus.id,
        requiredPermissionId: permission.id,
        requiresApproval: transition.requiresApproval,
        isActive: true,
        sortOrder: index + 1,
      },
    });
  }
}

async function seedTaskCategories() {
  console.log('Seeding default task category...');

  await prisma.taskCategory.upsert({
    where: {
      name: 'General',
    },
    update: {
      isActive: true,
    },
    create: {
      name: 'General',
      description: 'Default task category.',
      isActive: true,
    },
  });
}

async function seedSystemSettings() {
  console.log('Seeding system settings...');

  for (const setting of systemSettings) {
    await prisma.systemSetting.upsert({
      where: {
        key: setting.key,
      },
      update: {
        value: setting.value,
        category: setting.category,
        description: setting.description,
        isPublic: setting.isPublic ?? false,
      },
      create: {
        key: setting.key,
        value: setting.value,
        category: setting.category,
        description: setting.description,
        isPublic: setting.isPublic ?? false,
      },
    });
  }
}

async function main() {
  console.log('Starting Unicolors database seed...');

  await seedPermissions();
  await seedRoles();
  await seedRolePermissions();
  await seedTaskStatuses();
  await seedWorkflowTransitions();
  await seedTaskCategories();
  await seedSystemSettings();

  console.log('✅ Database seed completed successfully.');
}

main()
  .catch((error) => {
    console.error('❌ Database seed failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });