import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  LoginEventType,
  NotificationKind,
} from '../generated/prisma/enums';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { CreateHrJoinRequestDto } from './dto/create-hr-join-request.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { ActivateEmployeeLoginDto } from './dto/activate-employee-login.dto';
import { UpdateEmployeeLoginDto } from './dto/update-employee-login.dto';
import { CreateSuperAdminDto } from './dto/create-super-admin.dto';

type HrJoinPayload = {
  fullName: string;
  role: string;
  joinDate: string;
  departmentId?: string | null;
  departmentName?: string | null;
};

type EmployeeAccessContext = {
  userId?: string;
  roles?: string[];
};

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private normalizeDepartmentName(
    value?: string | null,
  ) {
    return (value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  private async assertHrDepartmentHead(
    access: EmployeeAccessContext,
  ) {
    if (!access.userId) {
      throw new ForbiddenException(
        'HR access is not available.',
      );
    }

    const employee =
      await this.prisma.employeeProfile.findFirst({
        where: {
          userId: access.userId,
          deletedAt: null,
        },
        select: {
          id: true,
          fullName: true,
          managedDepartments: {
            where: {
              deletedAt: null,
              isActive: true,
            },
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    const hrDepartment =
      employee?.managedDepartments.find(
        (department) => {
          const normalized =
            this.normalizeDepartmentName(
              department.name,
            );

          return (
            normalized === 'hr' ||
            normalized === 'humanresources'
          );
        },
      );

    if (!employee || !hrDepartment) {
      throw new ForbiddenException(
        'Only the HR department HOD can use this area.',
      );
    }

    return {
      employee,
      department: hrDepartment,
    };
  }

  private normalizeUsername(
    value?: string | null,
  ) {
    const username =
      value
        ?.trim()
        .replace(/^@+/, '')
        .toLowerCase() || null;

    if (!username) {
      return null;
    }

    if (
      !/^[a-z0-9._-]{3,30}$/.test(
        username,
      )
    ) {
      throw new BadRequestException(
        'Username must be 3-30 characters and can only contain letters, numbers, dot, underscore and hyphen.',
      );
    }

    return username;
  }

  private async validateDepartment(
    departmentId?: string | null,
  ) {
    if (!departmentId) return;

    const department =
      await this.prisma.department.findFirst({
        where: {
          id: departmentId,
          deletedAt: null,
          isActive: true,
        },
      });

    if (!department) {
      throw new NotFoundException(
        'Department not found.',
      );
    }
  }

  private async validateManager(
    reportingManagerId?: string | null,
    currentEmployeeId?: string,
  ) {
    if (!reportingManagerId) return;

    if (
      currentEmployeeId &&
      reportingManagerId ===
        currentEmployeeId
    ) {
      throw new BadRequestException(
        'Employee cannot report to themselves.',
      );
    }

    const manager =
      await this.prisma.employeeProfile.findFirst({
        where: {
          id: reportingManagerId,
          deletedAt: null,
        },
      });

    if (!manager) {
      throw new NotFoundException(
        'Reporting manager not found.',
      );
    }
  }

  private async getRoles(
    roleNames?: string[],
  ) {
    const names =
      roleNames?.length
        ? [...new Set(roleNames)]
        : ['EMPLOYEE'];

    const roles =
      await this.prisma.role.findMany({
        where: {
          name: {
            in: names,
          },
          isActive: true,
        },
      });

    if (roles.length !== names.length) {
      throw new BadRequestException(
        'One or more selected roles are invalid.',
      );
    }

    return roles;
  }

  async findAll(
    query: EmployeeQueryDto,
    access: EmployeeAccessContext = {},
  ) {
    const search =
      query.search?.trim();

    const roles =
      access.roles ?? [];

    const isDepartmentScopedUser =
      (roles.includes('MANAGER') ||
        roles.includes('EMPLOYEE')) &&
      !roles.includes('ADMIN') &&
      !roles.includes('SUPER_ADMIN');

    let scopedDepartmentId:
      | string
      | null
      | undefined;

    if (isDepartmentScopedUser) {
      if (!access.userId) {
        return [];
      }

      const employeeProfile =
        await this.prisma.employeeProfile.findUnique({
          where: {
            userId: access.userId,
          },
          select: {
            departmentId: true,
          },
        });

      if (!employeeProfile?.departmentId) {
        return [];
      }

      scopedDepartmentId =
        employeeProfile.departmentId;
    }

    const departmentId =
      scopedDepartmentId ??
      query.departmentId;

    return this.prisma.employeeProfile.findMany({
      where: {
        deletedAt: null,

        ...(departmentId && {
          departmentId,
        }),

        ...(query.employmentStatus && {
          employmentStatus:
            query.employmentStatus,
        }),

        ...(search && {
          OR: [
            {
              fullName: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              employeeId: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              username: {
                contains: search,
                mode: 'insensitive',
              },
            },
          ],
        }),
      },

      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            isActive: true,
            mustChangePassword: true,
            lastLoginAt: true,
            roles: {
              include: {
                role: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },

        department: {
          select: {
            id: true,
            name: true,
          },
        },

        reportingManager: {
          select: {
            id: true,
            employeeId: true,
            username: true,
            fullName: true,
            designation: true,
          },
        },

        teamMemberships: {
          where: {
            leftAt: null,
          },
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },

      orderBy: {
        fullName: 'asc',
      },
    });
  }


  async findTeamDirectory(
    query: EmployeeQueryDto,
    access: EmployeeAccessContext = {},
  ) {
    if (!access.userId) {
      throw new ForbiddenException(
        'Authenticated user not found.',
      );
    }

    const roles = access.roles ?? [];
    const canViewAll =
      roles.includes('SUPER_ADMIN') ||
      roles.includes('ADMIN');

    let scopedDepartmentIds: string[] | null =
      null;

    if (!canViewAll) {
      const employeeProfile =
        await this.prisma.employeeProfile.findUnique({
          where: {
            userId: access.userId,
          },
          select: {
            departmentId: true,
            managedDepartments: {
              where: {
                deletedAt: null,
                isActive: true,
              },
              select: {
                id: true,
              },
            },
          },
        });

      if (!employeeProfile) {
        return [];
      }

      if (roles.includes('MANAGER')) {
        scopedDepartmentIds = [
          ...new Set(
            [
              employeeProfile.departmentId,
              ...employeeProfile.managedDepartments.map(
                (department) => department.id,
              ),
            ].filter(
              (departmentId): departmentId is string =>
                Boolean(departmentId),
            ),
          ),
        ];
      } else if (roles.includes('EMPLOYEE')) {
        scopedDepartmentIds =
          employeeProfile.departmentId
            ? [employeeProfile.departmentId]
            : [];
      } else {
        scopedDepartmentIds = [];
      }

      if (!scopedDepartmentIds.length) {
        return [];
      }
    }

    const search = query.search?.trim();

    const scopedHeadIds = canViewAll
      ? []
      : (
          await this.prisma.department.findMany({
            where: {
              id: {
                in: scopedDepartmentIds ?? [],
              },
              deletedAt: null,
              isActive: true,
            },
            select: {
              headId: true,
            },
          })
        )
          .map((department) => department.headId)
          .filter(
            (headId): headId is string =>
              Boolean(headId),
          );

    const accessWhere: any = canViewAll
      ? query.departmentId
        ? { departmentId: query.departmentId }
        : {}
      : {
          OR: [
            {
              departmentId: {
                in: scopedDepartmentIds ?? [],
              },
            },
            ...(scopedHeadIds.length
              ? [
                  {
                    id: {
                      in: scopedHeadIds,
                    },
                  },
                ]
              : []),
          ],
        };

    return this.prisma.employeeProfile.findMany({
      where: {
        deletedAt: null,
        ...accessWhere,

        ...(query.employmentStatus && {
          employmentStatus:
            query.employmentStatus,
        }),

        ...(search && {
          OR: [
            {
              fullName: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              employeeId: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              username: {
                contains: search,
                mode: 'insensitive',
              },
            },
          ],
        }),
      },

      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            isActive: true,
            mustChangePassword: true,
            lastLoginAt: true,
            roles: {
              include: {
                role: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },

        department: {
          select: {
            id: true,
            name: true,
          },
        },

        reportingManager: {
          select: {
            id: true,
            employeeId: true,
            username: true,
            fullName: true,
            designation: true,
          },
        },

        teamMemberships: {
          where: {
            leftAt: null,
          },
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },

      orderBy: {
        fullName: 'asc',
      },
    });
  }

  async findMe(userId?: string) {
    if (!userId) {
      throw new BadRequestException(
        'Authenticated user not found.',
      );
    }

    const employee =
      await this.prisma.employeeProfile.findUnique({
        where: {
          userId,
        },
        select: {
          id: true,
          employeeId: true,
          username: true,
          fullName: true,
          designation: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          managedDepartments: {
            where: {
              deletedAt: null,
              isActive: true,
            },
            select: {
              id: true,
              name: true,
            },
            orderBy: {
              name: 'asc',
            },
          },
        },
      });

    if (!employee) {
      throw new NotFoundException(
        'Employee profile not found.',
      );
    }

    return employee;
  }

  private parseHrJoinPayload(
    value: unknown,
  ): HrJoinPayload | null {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      return null;
    }

    const record = value as Record<string, unknown>;

    if (
      typeof record.fullName !== 'string' ||
      typeof record.role !== 'string' ||
      typeof record.joinDate !== 'string'
    ) {
      return null;
    }

    return {
      fullName: record.fullName,
      role: record.role,
      joinDate: record.joinDate,
      departmentId:
        typeof record.departmentId === 'string'
          ? record.departmentId
          : null,
      departmentName:
        typeof record.departmentName === 'string'
          ? record.departmentName
          : null,
    };
  }

  private employeeJoinKey(
    fullName: string,
    joinDate?: Date | string | null,
  ) {
    const normalizedName = fullName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

    const date = joinDate
      ? new Date(joinDate)
      : null;

    const normalizedDate =
      date && !Number.isNaN(date.getTime())
        ? date.toISOString().slice(0, 10)
        : '';

    return `${normalizedName}|${normalizedDate}`;
  }

  async getHrDashboard(
    access: EmployeeAccessContext,
  ) {
    await this.assertHrDepartmentHead(access);

    const [employees, joinLogs] =
      await Promise.all([
        this.prisma.employeeProfile.findMany({
          where: {
            deletedAt: null,
            user: {
              roles: {
                none: {
                  role: {
                    name: 'SUPER_ADMIN',
                  },
                },
              },
            },
          },
          select: {
            id: true,
            employeeId: true,
            fullName: true,
            designation: true,
            joiningDate: true,
            user: {
              select: {
                isActive: true,
              },
            },
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            fullName: 'asc',
          },
        }),
        this.prisma.activityLog.findMany({
          where: {
            action: 'HR_EMPLOYEE_JOINED',
            entityType: 'HR_JOIN_REQUEST',
          },
          select: {
            entityId: true,
            newValue: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
      ]);

    const employeeById = new Map(
      employees.map((employee) => [
        employee.id,
        employee,
      ]),
    );

    const employeeByKey = new Map(
      employees.map((employee) => [
        this.employeeJoinKey(
          employee.fullName,
          employee.joiningDate,
        ),
        employee,
      ]),
    );

    const seen = new Set<string>();
    const hrEmployees = joinLogs
      .map((log) => {
        const payload =
          this.parseHrJoinPayload(log.newValue);

        if (!payload || !log.entityId) {
          return null;
        }

        const key = this.employeeJoinKey(
          payload.fullName,
          payload.joinDate,
        );

        const employee =
          employeeById.get(log.entityId) ??
          employeeByKey.get(key);

        const uniqueKey =
          employee?.id ?? key;

        if (seen.has(uniqueKey)) {
          return null;
        }

        seen.add(uniqueKey);

        return {
          id: employee?.id ?? log.entityId,
          employeeId:
            employee?.employeeId ?? null,
          fullName:
            employee?.fullName ??
            payload.fullName,
          role:
            payload.role ||
            employee?.designation ||
            '',
          joinDate:
            employee?.joiningDate?.toISOString() ??
            payload.joinDate,
          department:
            employee?.department ??
            (payload.departmentId
              ? {
                  id: payload.departmentId,
                  name:
                    payload.departmentName ??
                    payload.role,
                }
              : null),
          workspaceStatus:
            employee?.user.isActive
              ? ('WORKSPACE_READY' as const)
              : ('PENDING_LOGIN' as const),
          createdAt: log.createdAt.toISOString(),
        };
      })
      .filter(
        (
          employee,
        ): employee is NonNullable<
          typeof employee
        > => Boolean(employee),
      );

    const legacyKeys = new Set<string>();
    let unmatchedLegacyCount = 0;

    for (const log of joinLogs) {
      const payload =
        this.parseHrJoinPayload(log.newValue);

      if (!payload) {
        continue;
      }

      const key = this.employeeJoinKey(
        payload.fullName,
        payload.joinDate,
      );

      if (
        employeeByKey.has(key) ||
        legacyKeys.has(key)
      ) {
        continue;
      }

      legacyKeys.add(key);
      unmatchedLegacyCount += 1;
    }

    return {
      totalEmployees:
        employees.length + unmatchedLegacyCount,
      employees: hrEmployees,
    };
  }

  async createHrJoinRequest(
    dto: CreateHrJoinRequestDto,
    access: EmployeeAccessContext,
  ) {
    await this.assertHrDepartmentHead(access);

    if (!access.userId) {
      throw new ForbiddenException(
        'HR access is not available.',
      );
    }

    const fullName = dto.fullName.trim();
    const joinDate = new Date(dto.joinDate);
    const departmentId =
      dto.departmentId.trim();

    if (!fullName) {
      throw new BadRequestException(
        'Employee Name is required.',
      );
    }

    if (Number.isNaN(joinDate.getTime())) {
      throw new BadRequestException(
        'Invalid join date.',
      );
    }

    const department =
      await this.prisma.department.findFirst({
        where: {
          id: departmentId,
          deletedAt: null,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          head: {
            select: {
              userId: true,
            },
          },
        },
      });

    if (!department) {
      throw new NotFoundException(
        'Selected Role / Department was not found.',
      );
    }

    const role = department.name;

    const sameName =
      await this.prisma.employeeProfile.findMany({
        where: {
          deletedAt: null,
          departmentId: department.id,
          fullName: {
            equals: fullName,
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
          joiningDate: true,
        },
      });

    const duplicate = sameName.find(
      (employee) =>
        this.employeeJoinKey(
          fullName,
          employee.joiningDate,
        ) ===
        this.employeeJoinKey(
          fullName,
          joinDate,
        ),
    );

    if (duplicate) {
      throw new ConflictException(
        'This employee is already added for the selected Role / Department and Join Date.',
      );
    }

    const employeeRole =
      await this.prisma.role.findFirst({
        where: {
          name: 'EMPLOYEE',
          isActive: true,
        },
        select: {
          id: true,
        },
      });

    if (!employeeRole) {
      throw new BadRequestException(
        'EMPLOYEE role is not configured.',
      );
    }

    const placeholderPasswordHash =
      await hash(
        randomBytes(32).toString('base64url'),
        12,
      );

    const placeholderEmployeeId =
      `HRP-${Date.now()
        .toString(36)
        .toUpperCase()}-${randomBytes(3)
        .toString('hex')
        .toUpperCase()}`;

    const employee =
      await this.prisma.$transaction(
        async (tx) => {
          const user = await tx.user.create({
            data: {
              passwordHash:
                placeholderPasswordHash,
              isActive: false,
              mustChangePassword: true,
              roles: {
                create: {
                  roleId: employeeRole.id,
                },
              },
            },
          });

          const profile =
            await tx.employeeProfile.create({
              data: {
                userId: user.id,
                employeeId:
                  placeholderEmployeeId,
                fullName,
                designation: role,
                departmentId:
                  department.id,
                joiningDate: joinDate,
              },
            });

          const payload: HrJoinPayload = {
            fullName,
            role,
            joinDate:
              joinDate.toISOString(),
            departmentId:
              department.id,
            departmentName:
              department.name,
          };

          await tx.activityLog.create({
            data: {
              userId: access.userId,
              action:
                'HR_EMPLOYEE_JOINED',
              entityType:
                'HR_JOIN_REQUEST',
              entityId: profile.id,
              newValue: payload as any,
              metadata: {
                source:
                  'HR_ADD_EMPLOYEE',
                departmentId:
                  department.id,
                loginStatus:
                  'PENDING_SUPER_ADMIN',
              },
            },
          });

          return profile;
        },
      );

    const superAdmins =
      await this.prisma.user.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          roles: {
            some: {
              role: {
                name: 'SUPER_ADMIN',
                isActive: true,
              },
            },
          },
        },
        select: {
          id: true,
        },
      });

    const superAdminIds =
      superAdmins.map((item) => item.id);

    const joinDateLabel =
      joinDate.toISOString().slice(0, 10);

    const notifications = [
      ...superAdminIds.map((userId) => ({
        userId,
        actorId: access.userId!,
        kind:
          NotificationKind.USER_MENTIONED,
        title: 'New employee joined',
        message: `${fullName} joined ${department.name} on ${joinDateLabel}. The employee is already attached to this department. Please create/activate the workspace login from Department Team Member.`,
        entityType: 'EMPLOYEE',
        entityId: employee.id,
        redirectPath: '/departments',
      })),
    ];

    const hodUserId =
      department.head?.userId ?? null;

    if (
      hodUserId &&
      hodUserId !== access.userId &&
      !superAdminIds.includes(hodUserId)
    ) {
      notifications.push({
        userId: hodUserId,
        actorId: access.userId,
        kind:
          NotificationKind.USER_MENTIONED,
        title: 'New member in your department',
        message: `${fullName} joined your ${department.name} department on ${joinDateLabel}. Workspace login activation is pending with Super Admin.`,
        entityType: 'EMPLOYEE',
        entityId: employee.id,
        redirectPath: '/team',
      });
    }

    if (notifications.length) {
      await this.prisma.notification.createMany({
        data: notifications,
      });
    }

    return {
      id: employee.id,
      employeeId:
        placeholderEmployeeId,
      fullName,
      role,
      joinDate:
        joinDate.toISOString(),
      department: {
        id: department.id,
        name: department.name,
      },
      workspaceStatus:
        'PENDING_LOGIN' as const,
      superAdminNotified:
        superAdminIds.length > 0,
      hodNotified: Boolean(hodUserId),
    };
  }

  async findOne(id: string) {
    const employee =
      await this.prisma.employeeProfile.findFirst({
        where: {
          id,
          deletedAt: null,
        },

        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              isActive: true,
              lastLoginAt: true,
              phoneVerifiedAt: true,
              whatsappOptInAt: true,
              twoFactorEnabled: true,
              roles: {
                include: {
                  role: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },

          department: true,

          reportingManager: {
            select: {
              id: true,
              employeeId: true,
              username: true,
              fullName: true,
              designation: true,
            },
          },

          directReports: {
            where: {
              deletedAt: null,
            },
            select: {
              id: true,
              employeeId: true,
              username: true,
              fullName: true,
              designation: true,
            },
          },

          teamMemberships: {
            where: {
              leftAt: null,
            },
            include: {
              team: {
                include: {
                  department: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    if (!employee) {
      throw new NotFoundException(
        'Employee not found.',
      );
    }

    return employee;
  }

  async findSuperAdmins(
    access: EmployeeAccessContext = {},
  ) {
    this.assertSuperAdminLoginManager(access);

    return this.prisma.employeeProfile.findMany({
      where: {
        deletedAt: null,
        user: {
          deletedAt: null,
          roles: {
            some: {
              role: {
                isActive: true,
                name: 'SUPER_ADMIN',
              },
            },
          },
        },
      },
      select: {
        id: true,
        employeeId: true,
        username: true,
        fullName: true,
        designation: true,
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            isActive: true,
            mustChangePassword: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: {
        fullName: 'asc',
      },
    });
  }

  async createSuperAdmin(
    dto: CreateSuperAdminDto,
    access: EmployeeAccessContext = {},
  ) {
    this.assertSuperAdminLoginManager(access);

    const employeeId =
      `UC-SA-${randomBytes(4)
        .toString('hex')
        .toUpperCase()}`;

    return this.create(
      {
        employeeId,
        fullName: dto.fullName,
        username: dto.username,
        email: dto.email,
        phone: dto.phone,
        temporaryPassword:
          dto.temporaryPassword,
        designation: 'Super Admin',
        roleNames: ['SUPER_ADMIN'],
      },
      access,
    );
  }

  async create(
    dto: CreateEmployeeDto,
    access: EmployeeAccessContext = {},
  ) {
    const email =
      dto.email?.trim().toLowerCase() ||
      null;

    const phone =
      dto.phone?.trim() || null;

    if (!email && !phone) {
      throw new BadRequestException(
        'Email or phone number is required.',
      );
    }

    const departmentId =
      dto.departmentId?.trim() || null;

    const reportingManagerId =
      dto.reportingManagerId?.trim() || null;

    const employeeId =
      dto.employeeId.trim();

    const fullName =
      dto.fullName.trim();

    const username =
      this.normalizeUsername(
        dto.username,
      );

    const joiningDate =
      dto.joiningDate
        ? new Date(dto.joiningDate)
        : null;

    if (
      joiningDate &&
      Number.isNaN(
        joiningDate.getTime(),
      )
    ) {
      throw new BadRequestException(
        'Invalid joining date.',
      );
    }

    await this.validateDepartment(
      departmentId,
    );

    await this.validateManager(
      reportingManagerId,
    );

    if (
      dto.roleNames?.includes('SUPER_ADMIN') &&
      !access.roles?.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'Only Super Admin can create another Super Admin account.',
      );
    }

    const roles =
      await this.getRoles(
        dto.roleNames,
      );

    let pendingEmployee:
      | {
          id: string;
          userId: string;
          joiningDate: Date | null;
        }
      | null = null;

    if (departmentId && fullName) {
      const candidates =
        await this.prisma.employeeProfile.findMany({
          where: {
            deletedAt: null,
            departmentId,
            fullName: {
              equals: fullName,
              mode: 'insensitive',
            },
            user: {
              isActive: false,
              deletedAt: null,
            },
          },
          select: {
            id: true,
            userId: true,
            joiningDate: true,
          },
        });

      const candidateIds =
        candidates.map((item) => item.id);

      if (candidateIds.length) {
        const hrLogs =
          await this.prisma.activityLog.findMany({
            where: {
              action: 'HR_EMPLOYEE_JOINED',
              entityType: 'HR_JOIN_REQUEST',
              entityId: {
                in: candidateIds,
              },
            },
            select: {
              entityId: true,
            },
          });

        const hrIds = new Set(
          hrLogs
            .map((log) => log.entityId)
            .filter(
              (id): id is string =>
                Boolean(id),
            ),
        );

        let matches = candidates.filter(
          (candidate) =>
            hrIds.has(candidate.id),
        );

        if (joiningDate) {
          const expectedKey =
            this.employeeJoinKey(
              fullName,
              joiningDate,
            );

          matches = matches.filter(
            (candidate) =>
              this.employeeJoinKey(
                fullName,
                candidate.joiningDate,
              ) === expectedKey,
          );
        }

        if (matches.length > 1) {
          throw new ConflictException(
            'More than one pending HR employee matches this record. Please use the exact Join Date.',
          );
        }

        pendingEmployee =
          matches[0] ?? null;
      }
    }

    if (
      pendingEmployee &&
      !access.roles?.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'Only Super Admin can activate the workspace login for an employee added by HR.',
      );
    }

    if (username) {
      const existingUsername =
        await this.prisma.employeeProfile.findFirst({
          where: {
            username,
            ...(pendingEmployee && {
              id: {
                not: pendingEmployee.id,
              },
            }),
          },
        });

      if (existingUsername) {
        throw new ConflictException(
          'Username already exists.',
        );
      }
    }

    const existingEmployee =
      await this.prisma.employeeProfile.findFirst({
        where: {
          employeeId,
          ...(pendingEmployee && {
            id: {
              not: pendingEmployee.id,
            },
          }),
        },
      });

    if (existingEmployee) {
      throw new ConflictException(
        'Employee ID already exists.',
      );
    }

    if (email) {
      const existingEmail =
        await this.prisma.user.findFirst({
          where: {
            email,
            ...(pendingEmployee && {
              id: {
                not: pendingEmployee.userId,
              },
            }),
          },
        });

      if (existingEmail) {
        throw new ConflictException(
          'Email address already exists.',
        );
      }
    }

    if (phone) {
      const existingPhone =
        await this.prisma.user.findFirst({
          where: {
            phone,
            ...(pendingEmployee && {
              id: {
                not: pendingEmployee.userId,
              },
            }),
          },
        });

      if (existingPhone) {
        throw new ConflictException(
          'Phone number already exists.',
        );
      }
    }

    const passwordHash = await hash(
      dto.temporaryPassword,
      12,
    );

    if (pendingEmployee) {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.userRole.deleteMany({
            where: {
              userId:
                pendingEmployee!.userId,
            },
          });

          await tx.user.update({
            where: {
              id: pendingEmployee!.userId,
            },
            data: {
              email,
              phone,
              passwordHash,
              isActive: true,
              mustChangePassword: true,
              failedLoginAttempts: 0,
              lockedUntil: null,
              roles: {
                create: roles.map(
                  (role) => ({
                    roleId: role.id,
                  }),
                ),
              },
            },
          });

          await tx.employeeProfile.update({
            where: {
              id: pendingEmployee!.id,
            },
            data: {
              employeeId,
              username,
              fullName,
              profileImageUrl:
                dto.profileImageUrl?.trim() ||
                null,
              designation:
                dto.designation?.trim() ||
                null,
              departmentId,
              reportingManagerId,
              joiningDate:
                joiningDate ??
                pendingEmployee!.joiningDate,
              skills:
                dto.skills
                  ?.map((skill) =>
                    skill.trim(),
                  )
                  .filter(Boolean) ?? [],
            },
          });

          await tx.activityLog.create({
            data: {
              userId:
                access.userId ?? null,
              action:
                'HR_EMPLOYEE_LOGIN_ACTIVATED',
              entityType: 'EMPLOYEE',
              entityId:
                pendingEmployee!.id,
              newValue: {
                employeeId,
                fullName,
                departmentId,
                username,
                roles: roles.map(
                  (role) => role.name,
                ),
              },
              metadata: {
                source:
                  'SUPER_ADMIN_DEPARTMENT_TEAM_MEMBER',
              },
            },
          });
        },
      );

      return this.findOne(
        pendingEmployee.id,
      );
    }

    const employee =
      await this.prisma.$transaction(
        async (tx) => {
          const user =
            await tx.user.create({
              data: {
                email,
                phone,
                passwordHash,
                isActive: true,
                mustChangePassword: true,

                roles: {
                  create: roles.map(
                    (role) => ({
                      roleId: role.id,
                    }),
                  ),
                },
              },
            });

          return tx.employeeProfile.create({
            data: {
              userId: user.id,
              employeeId,
              username,
              fullName,

              profileImageUrl:
                dto.profileImageUrl?.trim() ||
                null,

              designation:
                dto.designation?.trim() ||
                null,

              departmentId,
              reportingManagerId,
              joiningDate,

              skills:
                dto.skills
                  ?.map((skill) =>
                    skill.trim(),
                  )
                  .filter(Boolean) ?? [],
            },
          });
        },
      );

    return this.findOne(employee.id);
  }


  private assertSuperAdminLoginManager(
    access: EmployeeAccessContext,
  ) {
    if (
      !access.userId ||
      !access.roles?.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'Only Super Admin can manage workspace login details.',
      );
    }
  }

  private async assertWorkspaceLoginIdentifiers(
    options: {
      employeeId: string;
      userId: string;
      username?: string | null;
      email?: string | null;
      phone?: string | null;
    },
  ) {
    const username =
      options.username
        ? this.normalizeUsername(
            options.username,
          )
        : null;

    const email =
      options.email
        ?.trim()
        .toLowerCase() || null;

    const phone =
      options.phone?.trim() || null;

    if (!email && !phone) {
      throw new BadRequestException(
        'Email or phone number is required for workspace login.',
      );
    }

    if (username) {
      const duplicateUsername =
        await this.prisma.employeeProfile.findFirst({
          where: {
            username,
            id: {
              not: options.employeeId,
            },
            deletedAt: null,
          },
          select: {
            id: true,
          },
        });

      if (duplicateUsername) {
        throw new ConflictException(
          'Username already exists.',
        );
      }
    }

    if (email) {
      const duplicateEmail =
        await this.prisma.user.findFirst({
          where: {
            email,
            id: {
              not: options.userId,
            },
            deletedAt: null,
          },
          select: {
            id: true,
          },
        });

      if (duplicateEmail) {
        throw new ConflictException(
          'Email address already exists.',
        );
      }
    }

    if (phone) {
      const duplicatePhone =
        await this.prisma.user.findFirst({
          where: {
            phone,
            id: {
              not: options.userId,
            },
            deletedAt: null,
          },
          select: {
            id: true,
          },
        });

      if (duplicatePhone) {
        throw new ConflictException(
          'Phone number already exists.',
        );
      }
    }

    return {
      username,
      email,
      phone,
    };
  }

  async activateWorkspaceLogin(
    employeeProfileId: string,
    dto: ActivateEmployeeLoginDto,
    access: EmployeeAccessContext,
  ) {
    this.assertSuperAdminLoginManager(access);

    const employee =
      await this.prisma.employeeProfile.findFirst({
        where: {
          id: employeeProfileId,
          deletedAt: null,
        },
        select: {
          id: true,
          userId: true,
          employeeId: true,
          fullName: true,
          departmentId: true,
          user: {
            select: {
              id: true,
              isActive: true,
              email: true,
              phone: true,
              roles: {
                where: {
                  role: {
                    isActive: true,
                  },
                },
                select: {
                  role: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    if (!employee) {
      throw new NotFoundException(
        'Employee not found.',
      );
    }

    if (employee.user.isActive) {
      throw new BadRequestException(
        'Workspace login is already active. Use Manage Login to edit it.',
      );
    }

    const hrJoinLog =
      await this.prisma.activityLog.findFirst({
        where: {
          action: 'HR_EMPLOYEE_JOINED',
          entityType: 'HR_JOIN_REQUEST',
          entityId: employee.id,
        },
        select: {
          id: true,
        },
      });

    if (!hrJoinLog) {
      throw new BadRequestException(
        'This employee is not a pending HR join record.',
      );
    }

    const identifiers =
      await this.assertWorkspaceLoginIdentifiers({
        employeeId: employee.id,
        userId: employee.userId,
        username: dto.username,
        email: dto.email,
        phone: dto.phone,
      });

    const passwordHash =
      await hash(
        dto.temporaryPassword,
        12,
      );

    let permanentEmployeeId =
      employee.employeeId;

    if (
      permanentEmployeeId.startsWith(
        'HRP-',
      )
    ) {
      let available = false;

      while (!available) {
        permanentEmployeeId =
          `UC-${randomBytes(4)
            .toString('hex')
            .toUpperCase()}`;

        const duplicate =
          await this.prisma.employeeProfile.findUnique({
            where: {
              employeeId:
                permanentEmployeeId,
            },
            select: {
              id: true,
            },
          });

        available = !duplicate;
      }
    }

    const roleNames =
      employee.user.roles.map(
        (item) => item.role.name,
      );

    await this.prisma.$transaction(
      async (tx) => {
        await tx.user.update({
          where: {
            id: employee.userId,
          },
          data: {
            email:
              identifiers.email,
            phone:
              identifiers.phone,
            passwordHash,
            isActive: true,
            mustChangePassword: true,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });

        await tx.employeeProfile.update({
          where: {
            id: employee.id,
          },
          data: {
            employeeId:
              permanentEmployeeId,
            username:
              identifiers.username,
          },
        });

        await tx.activityLog.create({
          data: {
            userId:
              access.userId!,
            action:
              'SUPER_ADMIN_EMPLOYEE_LOGIN_ACTIVATED',
            entityType:
              'EMPLOYEE',
            entityId:
              employee.id,
            newValue: {
              employeeId:
                permanentEmployeeId,
              username:
                identifiers.username,
              email:
                identifiers.email,
              phone:
                identifiers.phone,
              roles: roleNames,
            },
            metadata: {
              departmentId:
                employee.departmentId,
              source:
                'DEPARTMENT_MANAGE_LOGIN',
            },
          },
        });
      },
    );

    return this.findOne(employee.id);
  }

  async updateWorkspaceLogin(
    employeeProfileId: string,
    dto: UpdateEmployeeLoginDto,
    access: EmployeeAccessContext,
  ) {
    this.assertSuperAdminLoginManager(access);

    const employee =
      await this.findOne(
        employeeProfileId,
      );

    const roleNames =
      employee.user.roles.map(
        (item) => item.role.name,
      );

    const targetIsSuperAdmin =
      roleNames.includes(
        'SUPER_ADMIN',
      );

    if (
      targetIsSuperAdmin &&
      access.userId === employee.user.id &&
      dto.isActive === false
    ) {
      throw new BadRequestException(
        'You cannot deactivate your own Super Admin login.',
      );
    }

    const nextUsername =
      dto.username !== undefined
        ? dto.username
        : employee.username;

    const nextEmail =
      dto.email !== undefined
        ? dto.email
        : employee.user.email;

    const nextPhone =
      dto.phone !== undefined
        ? dto.phone
        : employee.user.phone;

    const identifiers =
      await this.assertWorkspaceLoginIdentifiers({
        employeeId:
          employee.id,
        userId:
          employee.user.id,
        username:
          nextUsername,
        email:
          nextEmail,
        phone:
          nextPhone,
      });

    const password =
      dto.temporaryPassword?.trim() ||
      null;

    const passwordHash =
      password
        ? await hash(
            password,
            12,
          )
        : null;

    const shouldRevokeSessions =
      Boolean(password) ||
      dto.isActive === false;

    const now = new Date();

    await this.prisma.$transaction(
      async (tx) => {
        await tx.user.update({
          where: {
            id:
              employee.user.id,
          },
          data: {
            ...(dto.email !==
              undefined && {
              email:
                identifiers.email,
            }),
            ...(dto.phone !==
              undefined && {
              phone:
                identifiers.phone,
            }),
            ...(dto.isActive !==
              undefined && {
              isActive:
                dto.isActive,
            }),
            ...(passwordHash && {
              passwordHash,
              mustChangePassword:
                true,
              failedLoginAttempts: 0,
              lockedUntil: null,
            }),
          },
        });

        if (
          dto.username !== undefined
        ) {
          await tx.employeeProfile.update({
            where: {
              id: employee.id,
            },
            data: {
              username:
                identifiers.username,
            },
          });
        }

        if (
          shouldRevokeSessions
        ) {
          await tx.refreshToken.updateMany({
            where: {
              userId:
                employee.user.id,
              revokedAt: null,
            },
            data: {
              revokedAt: now,
            },
          });
        }

        if (password) {
          await tx.passwordResetToken.updateMany({
            where: {
              userId:
                employee.user.id,
              usedAt: null,
            },
            data: {
              usedAt: now,
            },
          });
        }

        await tx.activityLog.create({
          data: {
            userId:
              access.userId!,
            action:
              'SUPER_ADMIN_EMPLOYEE_LOGIN_UPDATED',
            entityType:
              'EMPLOYEE',
            entityId:
              employee.id,
            newValue: {
              username:
                identifiers.username,
              email:
                identifiers.email,
              phone:
                identifiers.phone,
              isActive:
                dto.isActive ??
                employee.user.isActive,
              passwordChanged:
                Boolean(password),
            },
            metadata: {
              source:
                targetIsSuperAdmin
                  ? 'SUPER_ADMIN_ACCOUNTS'
                  : 'DEPARTMENT_MANAGE_LOGIN',
              sessionsRevoked:
                shouldRevokeSessions,
            },
          },
        });
      },
    );

    return this.findOne(employee.id);
  }

  async adminResetPassword(
    targetUserId: string,
    access: EmployeeAccessContext,
  ) {
    if (
      !access.userId ||
      !access.roles?.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'Only Super Admin can reset employee passwords from Login History.',
      );
    }

    if (targetUserId === access.userId) {
      throw new ForbiddenException(
        'Super Admin cannot reset their own password from Login History.',
      );
    }

    const target =
      await this.prisma.user.findFirst({
        where: {
          id: targetUserId,
          deletedAt: null,
        },
        select: {
          id: true,
          email: true,
          phone: true,
          isActive: true,
          employeeProfile: {
            select: {
              id: true,
              employeeId: true,
              username: true,
              fullName: true,
            },
          },
          roles: {
            where: {
              role: {
                isActive: true,
              },
            },
            select: {
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

    if (!target) {
      throw new NotFoundException(
        'User account not found.',
      );
    }

    const roleNames =
      target.roles.map(
        (item) => item.role.name,
      );

    if (
      roleNames.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'A Super Admin password cannot be reset from Login History.',
      );
    }

    const allowedRoles =
      new Set([
        'EMPLOYEE',
        'MANAGER',
        'ADMIN',
      ]);

    if (
      !roleNames.some((role) =>
        allowedRoles.has(role),
      )
    ) {
      throw new ForbiddenException(
        'Password reset is allowed only for Team Member, Manager/HOD and Admin accounts.',
      );
    }

    if (
      !target.employeeProfile ||
      !target.isActive
    ) {
      throw new BadRequestException(
        'This account is not an active workspace login.',
      );
    }

    const employeeProfile =
      target.employeeProfile;

    const temporaryPassword =
      `UC@${randomBytes(7)
        .toString('base64url')}9!`;

    const passwordHash =
      await hash(
        temporaryPassword,
        12,
      );

    const now = new Date();

    await this.prisma.$transaction(
      async (tx) => {
        await tx.user.update({
          where: {
            id: target.id,
          },
          data: {
            passwordHash,
            mustChangePassword: true,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });

        await tx.refreshToken.updateMany({
          where: {
            userId: target.id,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
          },
        });

        await tx.passwordResetToken.updateMany({
          where: {
            userId: target.id,
            usedAt: null,
          },
          data: {
            usedAt: now,
          },
        });

        await tx.loginHistory.create({
          data: {
            userId: target.id,
            eventType:
              LoginEventType.SESSION_REVOKED,
            identifier:
              employeeProfile
                .username ??
              target.email ??
              target.phone ??
              employeeProfile
                .employeeId,
            failureReason:
              'Password reset by Super Admin',
          },
        });

        await tx.activityLog.create({
          data: {
            userId: access.userId,
            action:
              'SUPER_ADMIN_PASSWORD_RESET',
            entityType: 'USER',
            entityId: target.id,
            newValue: {
              mustChangePassword: true,
              sessionsRevoked: true,
            },
            metadata: {
              targetEmployeeId:
                employeeProfile
                  .employeeId,
              targetEmployeeName:
                employeeProfile
                  .fullName,
              targetRoles: roleNames,
              source:
                'ACTIVITY_LOG_LOGIN_HISTORY',
            },
          },
        });
      },
    );

    return {
      userId: target.id,
      employeeId:
        employeeProfile.employeeId,
      fullName:
        employeeProfile.fullName,
      username:
        employeeProfile.username,
      roles: roleNames,
      temporaryPassword,
      mustChangePassword: true,
      sessionsRevoked: true,
    };
  }

  async update(
    id: string,
    dto: UpdateEmployeeDto,
  ) {
    const existing =
      await this.findOne(id);

    const email =
      dto.email !== undefined
        ? dto.email.trim().toLowerCase() ||
          null
        : undefined;

    const phone =
      dto.phone !== undefined
        ? dto.phone.trim() || null
        : undefined;

    const username =
      dto.username !== undefined
        ? this.normalizeUsername(
            dto.username,
          )
        : undefined;

    if (username) {
      const duplicateUsername =
        await this.prisma.employeeProfile.findFirst({
          where: {
            username,
            id: {
              not: id,
            },
          },
        });

      if (duplicateUsername) {
        throw new ConflictException(
          'Username already exists.',
        );
      }
    }

    if (email) {
      const duplicate =
        await this.prisma.user.findFirst({
          where: {
            email,
            id: {
              not: existing.user.id,
            },
          },
        });

      if (duplicate) {
        throw new ConflictException(
          'Email address already exists.',
        );
      }
    }

    if (phone) {
      const duplicate =
        await this.prisma.user.findFirst({
          where: {
            phone,
            id: {
              not: existing.user.id,
            },
          },
        });

      if (duplicate) {
        throw new ConflictException(
          'Phone number already exists.',
        );
      }
    }

    if (
      dto.departmentId !== undefined &&
      dto.departmentId.trim()
    ) {
      await this.validateDepartment(
        dto.departmentId.trim(),
      );
    }

    if (
      dto.reportingManagerId !==
      undefined
    ) {
      await this.validateManager(
        dto.reportingManagerId.trim() ||
          null,
        id,
      );
    }

    const roles =
      dto.roleNames !== undefined
        ? await this.getRoles(
            dto.roleNames,
          )
        : null;

    let joiningDate:
      | Date
      | null
      | undefined;

    if (
      dto.joiningDate !== undefined
    ) {
      joiningDate =
        dto.joiningDate.trim()
          ? new Date(dto.joiningDate)
          : null;

      if (
        joiningDate &&
        Number.isNaN(
          joiningDate.getTime(),
        )
      ) {
        throw new BadRequestException(
          'Invalid joining date.',
        );
      }
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.user.update({
          where: {
            id: existing.user.id,
          },
          data: {
            ...(email !== undefined && {
              email,
            }),

            ...(phone !== undefined && {
              phone,
            }),

            ...(dto.isActive !==
              undefined && {
              isActive: dto.isActive,
            }),
          },
        });

        await tx.employeeProfile.update({
          where: {
            id,
          },
          data: {
            ...(username !== undefined && {
              username,
            }),

            ...(dto.fullName !==
              undefined && {
              fullName:
                dto.fullName.trim(),
            }),

            ...(dto.designation !==
              undefined && {
              designation:
                dto.designation.trim() ||
                null,
            }),

            ...(dto.profileImageUrl !==
              undefined && {
              profileImageUrl:
                dto.profileImageUrl.trim() ||
                null,
            }),

            ...(dto.departmentId !==
              undefined && {
              departmentId:
                dto.departmentId.trim() ||
                null,
            }),

            ...(dto.reportingManagerId !==
              undefined && {
              reportingManagerId:
                dto.reportingManagerId.trim() ||
                null,
            }),

            ...(joiningDate !==
              undefined && {
              joiningDate,
            }),

            ...(dto.employmentStatus !==
              undefined && {
              employmentStatus:
                dto.employmentStatus,
            }),

            ...(dto.skills !==
              undefined && {
              skills: dto.skills
                .map((skill) =>
                  skill.trim(),
                )
                .filter(Boolean),
            }),
          },
        });

        if (roles) {
          await tx.userRole.deleteMany({
            where: {
              userId:
                existing.user.id,
            },
          });

          await tx.userRole.createMany({
            data: roles.map(
              (role) => ({
                userId:
                  existing.user.id,
                roleId: role.id,
              }),
            ),
          });
        }
      },
    );

    return this.findOne(id);
  }

  async remove(
    id: string,
    access: EmployeeAccessContext = {},
  ) {
    this.assertSuperAdminLoginManager(access);

    const employee =
      await this.findOne(id);

    const roleNames =
      employee.user.roles.map(
        (item) => item.role.name,
      );

    if (
      roleNames.includes('SUPER_ADMIN')
    ) {
      throw new BadRequestException(
        'Super Admin accounts cannot be removed from Team Member Management.',
      );
    }

    if (
      employee.user.id === access.userId
    ) {
      throw new BadRequestException(
        'You cannot remove your own workspace account.',
      );
    }

    const [activeTaskCount, activeProjectCount] =
      await Promise.all([
        this.prisma.task.count({
          where: {
            deletedAt: null,
            status: {
              code: {
                notIn: [
                  'DONE',
                  'COMPLETED',
                  'CANCELLED',
                  'ARCHIVED',
                ],
              },
            },
            OR: [
              {
                assignees: {
                  some: {
                    employeeId: id,
                    removedAt: null,
                  },
                },
              },
              {
                collaborators: {
                  some: {
                    employeeId: id,
                    removedAt: null,
                  },
                },
              },
              {
                reviewers: {
                  some: {
                    employeeId: id,
                  },
                },
              },
            ],
          },
        }),
        this.prisma.project.count({
          where: {
            deletedAt: null,
            status: {
              notIn: [
                'COMPLETED',
                'CANCELLED',
                'ARCHIVED',
              ],
            },
            OR: [
              {
                projectManagerId: id,
              },
              {
                members: {
                  some: {
                    employeeId: id,
                    isActive: true,
                  },
                },
              },
            ],
          },
        }),
      ]);

    if (
      activeTaskCount > 0 ||
      activeProjectCount > 0
    ) {
      throw new BadRequestException(
        `Reassign this member before removal. Active tasks: ${activeTaskCount}; active projects: ${activeProjectCount}.`,
      );
    }

    const now = new Date();

    await this.prisma.$transaction(
      async (tx) => {
        await tx.department.updateMany({
          where: {
            headId: id,
            deletedAt: null,
          },
          data: {
            headId: null,
          },
        });

        await tx.employeeProfile.updateMany({
          where: {
            reportingManagerId: id,
            deletedAt: null,
          },
          data: {
            reportingManagerId: null,
          },
        });

        await tx.teamMember.updateMany({
          where: {
            employeeId: id,
            leftAt: null,
          },
          data: {
            leftAt: now,
          },
        });

        await tx.projectMember.updateMany({
          where: {
            employeeId: id,
            isActive: true,
          },
          data: {
            isActive: false,
            leftAt: now,
          },
        });

        await tx.refreshToken.updateMany({
          where: {
            userId: employee.user.id,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
          },
        });

        await tx.passwordResetToken.updateMany({
          where: {
            userId: employee.user.id,
            usedAt: null,
          },
          data: {
            usedAt: now,
          },
        });

        await tx.employeeProfile.update({
          where: {
            id,
          },
          data: {
            deletedAt: now,
            employmentStatus:
              'RESIGNED',
          },
        });

        await tx.user.update({
          where: {
            id: employee.user.id,
          },
          data: {
            isActive: false,
            deletedAt: now,
          },
        });

        await tx.loginHistory.create({
          data: {
            userId: employee.user.id,
            eventType:
              LoginEventType.SESSION_REVOKED,
            identifier:
              employee.username ??
              employee.user.email ??
              employee.user.phone ??
              employee.employeeId,
            failureReason:
              'Team member removed by Super Admin',
          },
        });

        await tx.activityLog.create({
          data: {
            userId: access.userId,
            action:
              'TEAM_MEMBER_REMOVED',
            entityType: 'EMPLOYEE',
            entityId: id,
            newValue: {
              employmentStatus:
                'RESIGNED',
              loginActive: false,
            },
            metadata: {
              source:
                'SUPER_ADMIN_SETTINGS_TEAM_MEMBER_MANAGEMENT',
              historyPreserved: true,
              previousEmployeeId:
                employee.employeeId,
              previousFullName:
                employee.fullName,
              previousEmploymentStatus:
                employee.employmentStatus,
            },
          },
        });
      },
    );

    return {
      success: true,
      message:
        'Team member removed. Login access is disabled and historical work is preserved.',
    };
  }
}