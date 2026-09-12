import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  ClientAccountsStage,
  ClientOnboardingStage,
  ClientStatus,
  NotificationKind,
  ProjectStatus,
  MilestoneStatus,
} from '../generated/prisma/enums';

import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { UpdateClientAccountsDto } from './dto/update-client-accounts.dto';
import { UpdateClientOnboardingDto } from './dto/update-client-onboarding.dto';
import { ManageClientApprovalDto } from './dto/manage-client-approval.dto';
import { ClientQueryDto } from './dto/client-query.dto';

import { CreateClientContactDto } from './dto/create-client-contact.dto';
import { UpdateClientContactDto } from './dto/update-client-contact.dto';

type ClientWorkflowAccessContext = {
  userId?: string;
  roles?: string[];
};

type ResolvedClientWorkflowAccess = {
  userId: string | null;
  employeeId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  isBusinessDevelopment: boolean;
  isAccounts: boolean;
  isClientServicing: boolean;
  canOnboard: boolean;
  canAccounts: boolean;
  canClientServicing: boolean;
  canManageAll: boolean;
  canManageApprovedClient: boolean;
  managedDepartments: Array<{
    id: string;
    name: string;
  }>;
};

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private clean(value?: string) {
    const cleaned = value?.trim();

    return cleaned || null;
  }

  private normalizeDepartmentName(value?: string | null) {
    return (value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  private isBusinessDevelopmentDepartment(value?: string | null) {
    const normalized = this.normalizeDepartmentName(value);

    return [
      'businessdevelopment',
      'businessdevelopmentmanager',
      'businessdevelopmentdepartment',
      'bdm',
      'bd',
    ].includes(normalized);
  }

  private isAccountsDepartment(value?: string | null) {
    const normalized = this.normalizeDepartmentName(value);

    return [
      'accounts',
      'account',
      'accountsquotation',
      'accountsandquotation',
      'accountsfinance',
      'accountsandfinance',
      'finance',
    ].includes(normalized);
  }

  private isClientServicingDepartment(value?: string | null) {
    const normalized = this.normalizeDepartmentName(value);

    return [
      'clientservicing',
      'clientservice',
      'clientservicingdepartment',
      'clientrelations',
      'clientrelationship',
    ].includes(normalized);
  }

  private async resolveWorkflowAccess(
    access: ClientWorkflowAccessContext,
  ): Promise<ResolvedClientWorkflowAccess> {
    const roles = access.roles ?? [];
    const canManageAll =
      roles.includes('SUPER_ADMIN') ||
      roles.includes('ADMIN');

    const employee = access.userId
      ? await this.prisma.employeeProfile.findFirst({
          where: {
            userId: access.userId,
            deletedAt: null,
          },
          select: {
            id: true,
            departmentId: true,
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
            },
          },
        })
      : null;

    const departments = [
      ...(employee?.department
        ? [employee.department]
        : []),
      ...(employee?.managedDepartments ?? []),
    ];

    const businessDevelopmentDepartment =
      departments.find((department) =>
        this.isBusinessDevelopmentDepartment(
          department.name,
        ),
      ) ?? null;

    const accountsDepartment =
      departments.find((department) =>
        this.isAccountsDepartment(
          department.name,
        ),
      ) ?? null;

    const clientServicingDepartment =
      departments.find((department) =>
        this.isClientServicingDepartment(
          department.name,
        ),
      ) ?? null;

    const departmentName =
      businessDevelopmentDepartment?.name ??
      accountsDepartment?.name ??
      clientServicingDepartment?.name ??
      employee?.department?.name ??
      null;

    const departmentId =
      businessDevelopmentDepartment?.id ??
      accountsDepartment?.id ??
      clientServicingDepartment?.id ??
      employee?.departmentId ??
      null;

    const isBusinessDevelopment =
      Boolean(businessDevelopmentDepartment);

    const isAccounts =
      Boolean(accountsDepartment);

    const isClientServicing =
      Boolean(clientServicingDepartment);

    return {
      userId: access.userId ?? null,
      employeeId: employee?.id ?? null,
      departmentId,
      departmentName,
      isBusinessDevelopment,
      isAccounts,
      isClientServicing,
      canOnboard: canManageAll || isBusinessDevelopment,
      canAccounts: canManageAll || isAccounts,
      canClientServicing: canManageAll || isClientServicing,
      canManageAll,
      canManageApprovedClient:
        roles.includes('SUPER_ADMIN') || isBusinessDevelopment,
      managedDepartments: Array.from(
        new Map(
          departments.map((department) => [department.id, department]),
        ).values(),
      ),
    };
  }

  async getWorkflowAccess(
    access: ClientWorkflowAccessContext,
  ) {
    return this.resolveWorkflowAccess(access);
  }

  private async requireOnboardingAccess(
    access: ClientWorkflowAccessContext,
  ) {
    const resolved = await this.resolveWorkflowAccess(access);

    if (!resolved.canOnboard) {
      throw new ForbiddenException(
        'Client onboarding is available only to Business Development, Admin and Super Admin.',
      );
    }

    return resolved;
  }


  private async requireAccountsAccess(
    access: ClientWorkflowAccessContext,
  ) {
    const resolved = await this.resolveWorkflowAccess(access);

    if (!resolved.canAccounts) {
      throw new ForbiddenException(
        'Accounts workflow is available only to Accounts & Quotation, Admin and Super Admin.',
      );
    }

    return resolved;
  }

  private async requireClientServicingAccess(
    access: ClientWorkflowAccessContext,
  ) {
    const resolved = await this.resolveWorkflowAccess(access);

    if (!resolved.canClientServicing) {
      throw new ForbiddenException(
        'Client Servicing workflow is available only to Client Servicing, Admin and Super Admin.',
      );
    }

    return resolved;
  }


  private async validateAccountManager(
    employeeId?: string | null,
  ) {
    if (!employeeId) {
      return null;
    }

    const employee =
      await this.prisma.employeeProfile.findFirst({
        where: {
          id: employeeId,
          deletedAt: null,
          user: {
            isActive: true,
          },
        },
        select: {
          id: true,
          fullName: true,
        },
      });

    if (!employee) {
      throw new BadRequestException(
        'Account manager not found or inactive.',
      );
    }

    return employee;
  }

  private async validateClientServicing(
    employeeId?: string | null,
  ) {
    if (!employeeId) {
      return null;
    }

    const employee =
      await this.prisma.employeeProfile.findFirst({
        where: {
          id: employeeId,
          deletedAt: null,
          user: {
            isActive: true,
          },
        },
        select: {
          id: true,
          fullName: true,
        },
      });

    if (!employee) {
      throw new BadRequestException(
        'Client servicing employee not found or inactive.',
      );
    }

    return employee;
  }

  async findAll(query: ClientQueryDto) {
    const page = Math.max(
      Number(query.page) || 1,
      1,
    );

    const limit = Math.min(
      Math.max(
        Number(query.limit) || 20,
        1,
      ),
      100,
    );

    const skip =
      (page - 1) * limit;

    const search =
      query.search?.trim();

    const where: any = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          companyName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          phone: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          industry: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (query.status) {
      where.status =
        query.status as ClientStatus;
    }

    if (query.onboardingStage) {
      where.onboardingStage =
        query.onboardingStage as ClientOnboardingStage;
    }

    if (query.accountManagerId) {
      where.accountManagerId =
        query.accountManagerId.trim();
    }

    if (query.isActive) {
      where.isActive =
        query.isActive === 'true';
    }

    const direction =
      query.sortOrder === 'asc'
        ? ('asc' as const)
        : ('desc' as const);

    const orderBy =
      query.sortBy === 'name'
        ? {
            name: direction,
          }
        : query.sortBy ===
            'companyName'
          ? {
              companyName:
                direction,
            }
          : {
              createdAt:
                direction,
            };

    const [clients, total] =
      await Promise.all([
        this.prisma.client.findMany({
          where,
          skip,
          take: limit,
          orderBy,

          include: {
            accountManager: {
              select: {
                id: true,
                employeeId: true,
                fullName: true,
                designation: true,
              },
            },

            clientServicing: {
              select: {
                id: true,
                employeeId: true,
                fullName: true,
                designation: true,
              },
            },

            contacts: {
              where: {
                deletedAt: null,
              },

              orderBy: [
                {
                  isPrimary: 'desc',
                },
                {
                  createdAt: 'asc',
                },
              ],
            },
          },
        }),

        this.prisma.client.count({
          where,
        }),
      ]);

    const data =
      await Promise.all(
        clients.map(
          async (client) => {
            const [
              activeProjects,
              completedProjects,
              totalProjects,
            ] = await Promise.all([
              this.prisma.project.count({
                where: {
                  clientId: client.id,
                  status: 'ACTIVE',
                  deletedAt: null,
                },
              }),

              this.prisma.project.count({
                where: {
                  clientId: client.id,
                  status:
                    'COMPLETED',
                  deletedAt: null,
                },
              }),

              this.prisma.project.count({
                where: {
                  clientId: client.id,
                  deletedAt: null,
                },
              }),
            ]);

            return {
              ...client,
              activeProjects,
              completedProjects,
              totalProjects,
            };
          },
        ),
      );

    return {
      data,

      meta: {
        page,
        limit,
        total,
        totalPages:
          Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const client =
      await this.prisma.client.findFirst({
        where: {
          id,
          deletedAt: null,
        },

        include: {
          accountManager: {
            select: {
              id: true,
              employeeId: true,
              fullName: true,
              designation: true,
            },
          },

          clientServicing: {
            select: {
              id: true,
              employeeId: true,
              fullName: true,
              designation: true,
            },
          },

          contacts: {
            where: {
              deletedAt: null,
            },

            orderBy: [
              {
                isPrimary: 'desc',
              },
              {
                createdAt: 'asc',
              },
            ],
          },
        },
      });

    if (!client) {
      throw new NotFoundException(
        'Client not found.',
      );
    }

    const [
      activeProjects,
      completedProjects,
      totalProjects,
    ] = await Promise.all([
      this.prisma.project.count({
        where: {
          clientId: id,
          status: 'ACTIVE',
          deletedAt: null,
        },
      }),

      this.prisma.project.count({
        where: {
          clientId: id,
          status: 'COMPLETED',
          deletedAt: null,
        },
      }),

      this.prisma.project.count({
        where: {
          clientId: id,
          deletedAt: null,
        },
      }),
    ]);

    return {
      ...client,
      activeProjects,
      completedProjects,
      totalProjects,
    };
  }

  async create(
    dto: CreateClientDto,
    access: ClientWorkflowAccessContext,
  ) {
    const workflowAccess =
      await this.requireOnboardingAccess(access);

    let accountManagerId: string | null = null;

    if (
      workflowAccess.canManageAll &&
      dto.accountManagerId
    ) {
      accountManagerId = this.clean(
        dto.accountManagerId,
      );

      await this.validateAccountManager(
        accountManagerId,
      );
    } else {
      accountManagerId = workflowAccess.employeeId;
    }

    if (
      !workflowAccess.canManageAll &&
      !accountManagerId
    ) {
      throw new BadRequestException(
        'Business Development employee profile is required before creating a client.',
      );
    }

    let clientServicingId: string | null = null;

    if (
      workflowAccess.canManageAll &&
      dto.clientServicingId
    ) {
      clientServicingId = this.clean(
        dto.clientServicingId,
      );

      await this.validateClientServicing(
        clientServicingId,
      );
    }

    const client =
      await this.prisma.client.create({
        data: {
          name: dto.name.trim(),

          companyName:
            this.clean(dto.companyName),

          logoUrl:
            this.clean(dto.logoUrl),

          email:
            this.clean(dto.email),

          phone:
            this.clean(dto.phone),

          address:
            this.clean(dto.address),

          website:
            this.clean(dto.website),

          industry:
            this.clean(dto.industry),

          accountManagerId,
          clientServicingId,

          deliverables:
            dto.deliverables
              ?.map((item) => item.trim())
              .filter(Boolean) ?? [],

          primaryContacts:
            dto.primaryContacts
              ?.map((item) => item.trim())
              .filter(Boolean) ?? [],

          status: ClientStatus.LEAD,
          onboardingStage:
            ClientOnboardingStage.DRAFT,

          requirements:
            this.clean(dto.requirements),

          termsConditions:
            this.clean(dto.termsConditions),

          internalNotes:
            this.clean(dto.internalNotes),

          isActive: true,
        },
      });

    return this.findOne(client.id);
  }

  async update(
    id: string,
    dto: UpdateClientDto,
    access: ClientWorkflowAccessContext,
  ) {
    const workflowAccess =
      await this.requireOnboardingAccess(access);

    const current = await this.findOne(id);

    if (
      !workflowAccess.canManageAll &&
      current.onboardingStage ===
        ClientOnboardingStage.APPROVED
    ) {
      throw new ForbiddenException(
        'Approved clients are locked for Business Development. Accounts handover has already started.',
      );
    }

    let accountManagerId:
      | string
      | null
      | undefined;

    let clientServicingId:
      | string
      | null
      | undefined;

    if (
      workflowAccess.canManageAll &&
      dto.accountManagerId !== undefined
    ) {
      accountManagerId =
        this.clean(dto.accountManagerId);

      await this.validateAccountManager(
        accountManagerId,
      );
    }

    if (
      workflowAccess.canManageAll &&
      dto.clientServicingId !== undefined
    ) {
      clientServicingId =
        this.clean(dto.clientServicingId);

      await this.validateClientServicing(
        clientServicingId,
      );
    }

    await this.prisma.client.update({
      where: {
        id,
      },

      data: {
        ...(dto.name !== undefined && {
          name: dto.name.trim(),
        }),

        ...(dto.companyName !== undefined && {
          companyName:
            this.clean(dto.companyName),
        }),

        ...(dto.logoUrl !== undefined && {
          logoUrl:
            this.clean(dto.logoUrl),
        }),

        ...(dto.email !== undefined && {
          email:
            this.clean(dto.email),
        }),

        ...(dto.phone !== undefined && {
          phone:
            this.clean(dto.phone),
        }),

        ...(dto.address !== undefined && {
          address:
            this.clean(dto.address),
        }),

        ...(dto.website !== undefined && {
          website:
            this.clean(dto.website),
        }),

        ...(dto.industry !== undefined && {
          industry:
            this.clean(dto.industry),
        }),

        ...(workflowAccess.canManageAll &&
          dto.accountManagerId !== undefined && {
            accountManagerId,
          }),

        ...(workflowAccess.canManageAll &&
          dto.clientServicingId !== undefined && {
            clientServicingId,
          }),

        ...(dto.deliverables !== undefined && {
          deliverables:
            dto.deliverables
              .map((item) => item.trim())
              .filter(Boolean),
        }),

        ...(dto.primaryContacts !== undefined && {
          primaryContacts:
            dto.primaryContacts
              .map((item) => item.trim())
              .filter(Boolean),
        }),

        ...(dto.requirements !== undefined && {
          requirements:
            this.clean(dto.requirements),
        }),

        ...(dto.termsConditions !== undefined && {
          termsConditions:
            this.clean(dto.termsConditions),
        }),

        ...(workflowAccess.canManageAll &&
          dto.status !== undefined && {
            status:
              dto.status as ClientStatus,
          }),

        ...(dto.internalNotes !== undefined && {
          internalNotes:
            this.clean(dto.internalNotes),
        }),

        ...(workflowAccess.canManageAll &&
          dto.isActive !== undefined && {
            isActive: dto.isActive,
          }),
      },
    });

    return this.findOne(id);
  }

  async closeClient(
    id: string,
    access: ClientWorkflowAccessContext,
  ) {
    await this.requireClientServicingAccess(access);

    const client =
      await this.prisma.client.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          companyName: true,
          isActive: true,
          projects: {
            where: {
              deletedAt: null,
            },
            select: {
              id: true,
              projectManagerId: true,
              department: {
                select: {
                  headId: true,
                },
              },
              projectDepartments: {
                select: {
                  department: {
                    select: {
                      headId: true,
                    },
                  },
                },
              },
            },
          },
          tasks: {
            where: {
              deletedAt: null,
            },
            select: {
              id: true,
              assignees: {
                where: {
                  removedAt: null,
                },
                select: {
                  employeeId: true,
                },
              },
              collaborators: {
                where: {
                  removedAt: null,
                },
                select: {
                  employeeId: true,
                },
              },
              reviewers: {
                select: {
                  employeeId: true,
                },
              },
            },
          },
        },
      });

    if (!client) {
      throw new NotFoundException(
        'Client not found.',
      );
    }

    if (!client.isActive) {
      throw new BadRequestException(
        'Client is already closed.',
      );
    }

    const cancelledTaskStatus =
      await this.prisma.taskStatus.findFirst({
        where: {
          deletedAt: null,
          isActive: true,
          code: 'CANCELLED',
        },
        select: {
          id: true,
        },
      });

    if (!cancelledTaskStatus) {
      throw new BadRequestException(
        'CANCELLED task status is not configured.',
      );
    }

    const projectIds =
      client.projects.map(
        (project) => project.id,
      );

    const taskIds =
      client.tasks.map(
        (task) => task.id,
      );

    await this.prisma.$transaction(
      async (tx) => {
        await tx.client.update({
          where: {
            id,
          },
          data: {
            isActive: false,
            status:
              ClientStatus.INACTIVE,
          },
        });

        if (projectIds.length) {
          await tx.project.updateMany({
            where: {
              id: {
                in: projectIds,
              },
              deletedAt: null,
              status: {
                notIn: [
                  ProjectStatus.COMPLETED,
                  ProjectStatus.CANCELLED,
                  ProjectStatus.ARCHIVED,
                ],
              },
            },
            data: {
              status:
                ProjectStatus.CANCELLED,
              reviewStage: null,
            },
          });

          await tx.projectMilestone.updateMany({
            where: {
              projectId: {
                in: projectIds,
              },
              deletedAt: null,
              status: {
                notIn: [
                  MilestoneStatus.COMPLETED,
                  MilestoneStatus.CANCELLED,
                ],
              },
            },
            data: {
              status: MilestoneStatus.CANCELLED,
            },
          });
        }

        if (taskIds.length) {
          const closedStatuses =
            await tx.taskStatus.findMany({
              where: {
                code: {
                  in: [
                    'DONE',
                    'COMPLETED',
                    'CANCELLED',
                    'ARCHIVED',
                  ],
                },
              },
              select: {
                id: true,
              },
            });

          await tx.task.updateMany({
            where: {
              id: {
                in: taskIds,
              },
              deletedAt: null,
              statusId: {
                notIn:
                  closedStatuses.map(
                    (status) => status.id,
                  ),
              },
            },
            data: {
              statusId:
                cancelledTaskStatus.id,
            },
          });

          await tx.recurringTask.updateMany({
            where: {
              templateTaskId: {
                in: taskIds,
              },
              deletedAt: null,
            },
            data: {
              isActive: false,
              nextRunAt: null,
            },
          });
        }
      },
    );

    const employeeIds =
      new Set<string>();

    client.projects.forEach(
      (project) => {
        if (project.projectManagerId) {
          employeeIds.add(
            project.projectManagerId,
          );
        }

        if (project.department?.headId) {
          employeeIds.add(
            project.department.headId,
          );
        }

        project.projectDepartments.forEach(
          (link) => {
            if (link.department.headId) {
              employeeIds.add(
                link.department.headId,
              );
            }
          },
        );
      },
    );

    client.tasks.forEach((task) => {
      task.assignees.forEach((item) =>
        employeeIds.add(item.employeeId),
      );
      task.collaborators.forEach((item) =>
        employeeIds.add(item.employeeId),
      );
      task.reviewers.forEach((item) =>
        employeeIds.add(item.employeeId),
      );
    });

    if (employeeIds.size) {
      await this.notifications.notifyEmployees(
        [...employeeIds],
        {
          kind:
            NotificationKind.USER_MENTIONED,
          title: 'Client closed',
          message:
            `${client.companyName ?? client.name} has been closed. Open projects and tasks have been stopped.`,
          entityType: 'CLIENT',
          entityId: client.id,
          redirectPath: '/clients',
        },
      );
    }

    return this.findOne(id);
  }

  private assertOnboardingTransition(
    current: ClientOnboardingStage,
    next: ClientOnboardingStage,
  ) {
    const transitions: Record<
      ClientOnboardingStage,
      ClientOnboardingStage[]
    > = {
      [ClientOnboardingStage.DRAFT]: [
        ClientOnboardingStage.TERMS_SHARED,
      ],
      [ClientOnboardingStage.TERMS_SHARED]: [
        ClientOnboardingStage.AWAITING_CLIENT_APPROVAL,
      ],
      [ClientOnboardingStage.AWAITING_CLIENT_APPROVAL]: [
        ClientOnboardingStage.APPROVED,
        ClientOnboardingStage.REJECTED,
        ClientOnboardingStage.FOLLOW_UP,
      ],
      [ClientOnboardingStage.APPROVED]: [],
      [ClientOnboardingStage.REJECTED]: [
        ClientOnboardingStage.FOLLOW_UP,
      ],
      [ClientOnboardingStage.FOLLOW_UP]: [
        ClientOnboardingStage.TERMS_SHARED,
      ],
    };

    if (!transitions[current]?.includes(next)) {
      throw new BadRequestException(
        `Client onboarding cannot move from ${current} to ${next}.`,
      );
    }
  }

  private async accountsRecipients() {
    const departments =
      await this.prisma.department.findMany({
        where: {
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          head: {
            select: {
              userId: true,
            },
          },
          members: {
            where: {
              deletedAt: null,
              employmentStatus: 'ACTIVE',
              user: {
                isActive: true,
              },
            },
            select: {
              userId: true,
            },
          },
        },
      });

    const accountsDepartment = departments.find(
      (department) =>
        this.isAccountsDepartment(department.name),
    );

    if (!accountsDepartment) {
      throw new BadRequestException(
        'Accounts & Quotation department is not configured. Create or rename the Accounts department before approving a client.',
      );
    }

    const recipients = new Set<string>();

    if (accountsDepartment.head?.userId) {
      recipients.add(accountsDepartment.head.userId);
    }

    for (const member of accountsDepartment.members) {
      recipients.add(member.userId);
    }

    const superAdmins =
      await this.prisma.user.findMany({
        where: {
          isActive: true,
          deletedAt: null,
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

    for (const admin of superAdmins) {
      recipients.add(admin.id);
    }

    return {
      department: accountsDepartment,
      userIds: Array.from(recipients),
    };
  }

  async updateOnboarding(
    id: string,
    dto: UpdateClientOnboardingDto,
    access: ClientWorkflowAccessContext,
  ) {
    const workflowAccess =
      await this.requireOnboardingAccess(access);

    const client = await this.findOne(id);

    if (
      !workflowAccess.canManageAll &&
      client.onboardingStage ===
        ClientOnboardingStage.APPROVED
    ) {
      throw new ForbiddenException(
        'This client is already approved and handed to Accounts.',
      );
    }

    const nextStage =
      dto.stage as ClientOnboardingStage;

    this.assertOnboardingTransition(
      client.onboardingStage,
      nextStage,
    );

    const requirements =
      this.clean(dto.requirements) ??
      client.requirements;

    const termsConditions =
      this.clean(dto.termsConditions) ??
      client.termsConditions;

    if (
      nextStage ===
        ClientOnboardingStage.TERMS_SHARED &&
      (!requirements || !termsConditions)
    ) {
      throw new BadRequestException(
        'Requirements and Terms & Conditions are required before marking T&C as shared.',
      );
    }

    if (
      nextStage ===
        ClientOnboardingStage.AWAITING_CLIENT_APPROVAL &&
      (!client.termsSharedAt || !termsConditions)
    ) {
      throw new BadRequestException(
        'Terms & Conditions must be shared before waiting for client approval.',
      );
    }

    const now = new Date();
    const note = this.clean(dto.note);

    let accounts:
      | {
          department: {
            id: string;
            name: string;
          };
          userIds: string[];
        }
      | null = null;

    if (
      nextStage ===
      ClientOnboardingStage.APPROVED
    ) {
      accounts = await this.accountsRecipients();
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.client.update({
          where: {
            id,
          },
          data: {
            onboardingStage: nextStage,
            requirements,
            termsConditions,

            ...(nextStage ===
              ClientOnboardingStage.TERMS_SHARED && {
              termsSharedAt: now,
              clientApprovalNote: null,
              status: ClientStatus.LEAD,
            }),

            ...(nextStage ===
              ClientOnboardingStage.AWAITING_CLIENT_APPROVAL && {
              status: ClientStatus.LEAD,
            }),

            ...(nextStage ===
              ClientOnboardingStage.APPROVED && {
              clientApprovalAt: now,
              clientApprovalNote: note,
              accountsHandoverAt: now,
              accountsStage: ClientAccountsStage.NEW_HANDOVER,
              status: ClientStatus.ACTIVE,
            }),

            ...(nextStage ===
              ClientOnboardingStage.REJECTED && {
              clientApprovalNote: note,
              status: ClientStatus.ON_HOLD,
            }),

            ...(nextStage ===
              ClientOnboardingStage.FOLLOW_UP && {
              clientApprovalNote: note,
              status: ClientStatus.ON_HOLD,
            }),
          },
        });

        if (
          accounts &&
          accounts.userIds.length
        ) {
          await tx.notification.createMany({
            data: accounts.userIds.map(
              (userId) => ({
                userId,
                actorId:
                  workflowAccess.userId,
                kind:
                  NotificationKind.USER_MENTIONED,
                title:
                  'Client approved · Accounts handover',
                message:
                  `${client.companyName ?? client.name} has been approved by the client. Please start Accounts & Quotation processing.`,
                entityType: 'CLIENT',
                entityId: id,
                redirectPath:
                  '/clients?onboardingStage=APPROVED',
              }),
            ),
          });
        }
      },
    );

    return this.findOne(id);
  }

  async manageClientApproval(
    id: string,
    dto: ManageClientApprovalDto,
    access: ClientWorkflowAccessContext,
  ) {
    const workflowAccess = await this.resolveWorkflowAccess(access);

    if (!workflowAccess.canManageApprovedClient) {
      throw new ForbiddenException(
        'Only Super Admin or Business Development can manage an approved client.',
      );
    }

    const client = await this.findOne(id);

    const wasApprovedBefore = Boolean(
      client.accountsHandoverAt ||
      client.onboardingStage === ClientOnboardingStage.APPROVED,
    );

    if (!wasApprovedBefore) {
      throw new BadRequestException(
        'Approve the client through the T&C workflow first.',
      );
    }

    const note = this.clean(dto.note);
    const now = new Date();

    let nextStage = client.onboardingStage;
    let nextStatus = client.status;
    let nextApprovalAt = client.clientApprovalAt;

    if (dto.action === 'APPROVE') {
      nextStage = ClientOnboardingStage.APPROVED;
      nextStatus = ClientStatus.ACTIVE;
      nextApprovalAt = now;
    } else if (dto.action === 'UNAPPROVE') {
      if (!note) {
        throw new BadRequestException(
          'Add a reason before unapproving the client.',
        );
      }
      nextStage = ClientOnboardingStage.REJECTED;
      nextStatus = ClientStatus.ON_HOLD;
      nextApprovalAt = null;
    } else {
      if (!note) {
        throw new BadRequestException(
          'Add a discussion note.',
        );
      }
      nextStage = ClientOnboardingStage.FOLLOW_UP;
      nextStatus = ClientStatus.ON_HOLD;
      nextApprovalAt = null;
    }

    const firstAccountsHandover =
      dto.action === 'APPROVE' && !client.accountsHandoverAt;

    const accounts = firstAccountsHandover
      ? await this.accountsRecipients()
      : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: { id },
        data: {
          onboardingStage: nextStage,
          status: nextStatus,
          clientApprovalAt: nextApprovalAt,
          clientApprovalNote:
            dto.action === 'APPROVE'
              ? note ?? client.clientApprovalNote
              : note,
          ...(firstAccountsHandover
            ? {
                accountsHandoverAt: now,
                accountsStage: ClientAccountsStage.NEW_HANDOVER,
              }
            : {}),
        },
      });

      await tx.activityLog.create({
        data: {
          userId: workflowAccess.userId,
          action: `CLIENT_${dto.action}`,
          entityType: 'CLIENT',
          entityId: id,
          previousValue: {
            onboardingStage: client.onboardingStage,
            status: client.status,
          },
          newValue: {
            onboardingStage: nextStage,
            status: nextStatus,
            note,
          },
          metadata: {
            source: 'MANAGE_CLIENT_APPROVAL',
            accountsHandoverPreserved: Boolean(client.accountsHandoverAt),
          },
        },
      });

      if (accounts?.userIds.length) {
        await tx.notification.createMany({
          data: accounts.userIds.map((userId) => ({
            userId,
            actorId: workflowAccess.userId,
            kind: NotificationKind.USER_MENTIONED,
            title: 'Client approved · Accounts handover',
            message: `${client.companyName ?? client.name} has been approved. Please start Accounts & Quotation processing.`,
            entityType: 'CLIENT',
            entityId: id,
            redirectPath: '/clients?onboardingStage=APPROVED',
          })),
        });
      }
    });

    if (
      !firstAccountsHandover &&
      client.accountsHandoverAt &&
      dto.action !== 'APPROVE'
    ) {
      try {
        const accountsRecipients = await this.accountsRecipients();
        if (accountsRecipients.userIds.length) {
          await this.notifications.notifyUsers(
            accountsRecipients.userIds,
            {
              actorId: workflowAccess.userId ?? undefined,
              kind: NotificationKind.USER_MENTIONED,
              title:
                dto.action === 'UNAPPROVE'
                  ? 'Client approval withdrawn'
                  : 'Client moved to discussion',
              message: `${client.companyName ?? client.name}: ${note ?? 'Client approval status changed.'}`,
              entityType: 'CLIENT',
              entityId: id,
              redirectPath: '/clients',
            },
          );
        }
      } catch {
        // Approval state should still be saved even if Accounts is not configured.
      }
    }

    return this.findOne(id);
  }

  async getAccountsDashboard(
    access: ClientWorkflowAccessContext,
  ) {
    const workflowAccess =
      await this.requireAccountsAccess(access);

    // Repair any older handovers that were completed before the
    // multi-department recipient resolver was available.
    await this.backfillClientServicingHandoverNotifications(
      workflowAccess.userId,
    );

    const baseWhere = {
      deletedAt: null,
      onboardingStage: ClientOnboardingStage.APPROVED,
      accountsHandoverAt: {
        not: null,
      },
    };

    const [
      newHandovers,
      teamTotalQuotations,
      quotationPrepared,
      awaitingClientConfirmation,
      readyForClientServicing,
      handedToClientServicing,
      recentClients,
      quotationAuditLogs,
      accountsEmployee,
    ] = await Promise.all([
      this.prisma.client.count({
        where: {
          ...baseWhere,
          accountsStage: ClientAccountsStage.NEW_HANDOVER,
        },
      }),
      this.prisma.client.count({
        where: {
          ...baseWhere,
          quotationPreparedAt: {
            not: null,
          },
        },
      }),
      this.prisma.client.count({
        where: {
          ...baseWhere,
          accountsStage: ClientAccountsStage.QUOTATION_PREPARED,
        },
      }),
      this.prisma.client.count({
        where: {
          ...baseWhere,
          accountsStage: ClientAccountsStage.AWAITING_CLIENT_CONFIRMATION,
        },
      }),
      this.prisma.client.count({
        where: {
          ...baseWhere,
          accountsStage: ClientAccountsStage.READY_FOR_CLIENT_SERVICING,
        },
      }),
      this.prisma.client.count({
        where: {
          ...baseWhere,
          accountsStage: ClientAccountsStage.HANDED_TO_CLIENT_SERVICING,
        },
      }),
      this.prisma.client.findMany({
        where: baseWhere,
        orderBy: {
          accountsHandoverAt: 'desc',
        },
        take: 30,
        include: {
          accountManager: {
            select: {
              id: true,
              fullName: true,
              designation: true,
            },
          },
          clientServicing: {
            select: {
              id: true,
              fullName: true,
              designation: true,
            },
          },
        },
      }),
      this.prisma.activityLog.findMany({
        where: {
          entityType: 'CLIENT',
          action: 'CLIENT_UPDATED',
          entityId: {
            not: null,
          },
          userId: {
            not: null,
          },
        },
        select: {
          userId: true,
          entityId: true,
          newValue: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      }),
      workflowAccess.employeeId
        ? this.prisma.employeeProfile.findUnique({
            where: {
              id: workflowAccess.employeeId,
            },
            select: {
              fullName: true,
            },
          })
        : Promise.resolve(null),
    ]);

    // Audit logs let the Accounts dashboard show a genuine per-person
    // lifetime quotation count without changing the Client schema.
    // Count each client only once and credit the first user who prepared it.
    const firstPreparerByClient = new Map<string, string>();

    for (const log of quotationAuditLogs) {
      if (!log.entityId || !log.userId) {
        continue;
      }

      const value = log.newValue;

      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value)
      ) {
        continue;
      }

      const stage = (value as Record<string, unknown>).stage;

      if (
        stage !== ClientAccountsStage.QUOTATION_PREPARED ||
        firstPreparerByClient.has(log.entityId)
      ) {
        continue;
      }

      firstPreparerByClient.set(log.entityId, log.userId);
    }

    const personalTotalQuotations = workflowAccess.userId
      ? Array.from(firstPreparerByClient.values()).filter(
          (userId) => userId === workflowAccess.userId,
        ).length
      : teamTotalQuotations;

    const totalQuotations =
      workflowAccess.isAccounts && workflowAccess.userId
        ? personalTotalQuotations
        : teamTotalQuotations;

    return {
      newHandovers,
      pendingQuotations: newHandovers,
      totalQuotations,
      teamTotalQuotations,
      quotationPreparedByName:
        workflowAccess.isAccounts
          ? accountsEmployee?.fullName ?? null
          : null,
      quotationPrepared,
      awaitingClientConfirmation,
      readyForClientServicing,
      handedToClientServicing,
      recentClients,
    };
  }

  async getClientServicingDashboard(
    access: ClientWorkflowAccessContext,
  ) {
    await this.requireClientServicingAccess(access);

    const handedClientWhere = {
      deletedAt: null,
      isActive: true,
      onboardingStage: ClientOnboardingStage.APPROVED,
      accountsStage: ClientAccountsStage.HANDED_TO_CLIENT_SERVICING,
      clientServicingHandoverAt: {
        not: null,
      },
    } as const;

    const [
      newHandovers,
      projectsToCreate,
      activeProjects,
      awaitingDepartmentAssignment,
      inProgress,
      awaitingClientReview,
      completedProjects,
      recentHandovers,
    ] = await Promise.all([
      this.prisma.client.count({
        where: handedClientWhere,
      }),
      this.prisma.client.count({
        where: {
          ...handedClientWhere,
          projects: {
            none: {
              deletedAt: null,
            },
          },
        },
      }),
      this.prisma.project.count({
        where: {
          deletedAt: null,
          status: {
            in: [
              ProjectStatus.PLANNING,
              ProjectStatus.ACTIVE,
              ProjectStatus.ON_HOLD,
              ProjectStatus.UNDER_REVIEW,
            ],
          },
          client: handedClientWhere,
        },
      }),
      this.prisma.project.count({
        where: {
          deletedAt: null,
          status: ProjectStatus.PLANNING,
          client: handedClientWhere,
          projectDepartments: {
            none: {},
          },
        },
      }),
      this.prisma.project.count({
        where: {
          deletedAt: null,
          status: ProjectStatus.ACTIVE,
          client: handedClientWhere,
        },
      }),
      this.prisma.project.count({
        where: {
          deletedAt: null,
          status: ProjectStatus.UNDER_REVIEW,
          client: handedClientWhere,
        },
      }),
      this.prisma.project.count({
        where: {
          deletedAt: null,
          status: ProjectStatus.COMPLETED,
          client: handedClientWhere,
        },
      }),
      this.prisma.client.findMany({
        where: handedClientWhere,
        orderBy: {
          clientServicingHandoverAt: 'desc',
        },
        take: 100,
        select: {
          id: true,
          name: true,
          companyName: true,
          requirements: true,
          clientServicingHandoverAt: true,
          projects: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
            select: {
              id: true,
              name: true,
              status: true,
              deadline: true,
              createdAt: true,
              projectDepartments: {
                select: {
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
      }),
    ]);

    return {
      newHandovers,
      projectsToCreate,
      activeProjects,
      awaitingDepartmentAssignment,
      inProgress,
      awaitingClientReview,
      completedProjects,
      recentHandovers: recentHandovers.map((client) => {
        const latestProject = client.projects[0] ?? null;

        return {
          id: client.id,
          name: client.name,
          companyName: client.companyName,
          requirements: client.requirements,
          clientServicingHandoverAt:
            client.clientServicingHandoverAt,
          hasProject: Boolean(latestProject),
          project: latestProject
            ? {
                id: latestProject.id,
                name: latestProject.name,
                status: latestProject.status,
                deadline: latestProject.deadline,
                createdAt: latestProject.createdAt,
                departments:
                  latestProject.projectDepartments.map(
                    (link) => link.department,
                  ),
              }
            : null,
        };
      }),
    };
  }

  private assertAccountsTransition(
    current: ClientAccountsStage,
    next: ClientAccountsStage,
  ) {
    const transitions: Record<
      ClientAccountsStage,
      ClientAccountsStage[]
    > = {
      [ClientAccountsStage.NEW_HANDOVER]: [
        ClientAccountsStage.QUOTATION_PREPARED,
      ],
      [ClientAccountsStage.QUOTATION_PREPARED]: [
        ClientAccountsStage.AWAITING_CLIENT_CONFIRMATION,
      ],
      [ClientAccountsStage.AWAITING_CLIENT_CONFIRMATION]: [
        ClientAccountsStage.READY_FOR_CLIENT_SERVICING,
        ClientAccountsStage.QUOTATION_PREPARED,
      ],
      [ClientAccountsStage.READY_FOR_CLIENT_SERVICING]: [
        ClientAccountsStage.HANDED_TO_CLIENT_SERVICING,
      ],
      [ClientAccountsStage.HANDED_TO_CLIENT_SERVICING]: [],
    };

    if (!transitions[current]?.includes(next)) {
      throw new BadRequestException(
        `Accounts workflow cannot move from ${current} to ${next}.`,
      );
    }
  }

  private async clientServicingRecipients() {
    const departments =
      await this.prisma.department.findMany({
        where: {
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          head: {
            select: {
              id: true,
              userId: true,
            },
          },
        },
      });

    const department = departments.find(
      (item) =>
        this.isClientServicingDepartment(item.name),
    );

    if (!department) {
      throw new BadRequestException(
        'Client Servicing department is not configured. Create or rename the Client Servicing department before handover.',
      );
    }

    // A single employee can head/manage more than one department.
    // Resolve Client Servicing recipients from BOTH the primary department
    // membership and the managedDepartments/HOD relationship.
    const departmentPeople =
      await this.prisma.employeeProfile.findMany({
        where: {
          deletedAt: null,
          employmentStatus: 'ACTIVE',
          user: {
            isActive: true,
            deletedAt: null,
          },
          OR: [
            {
              departmentId: department.id,
            },
            {
              managedDepartments: {
                some: {
                  id: department.id,
                  isActive: true,
                  deletedAt: null,
                },
              },
            },
          ],
        },
        select: {
          id: true,
          userId: true,
          managedDepartments: {
            where: {
              id: department.id,
              isActive: true,
              deletedAt: null,
            },
            select: {
              id: true,
            },
          },
        },
      });

    const recipients = new Set<string>();

    for (const person of departmentPeople) {
      recipients.add(person.userId);
    }

    const departmentRecipientCount = recipients.size;

    // Do not silently complete an Accounts handover if Client Servicing
    // has no active person to receive it.
    if (!departmentRecipientCount) {
      throw new BadRequestException(
        'Client Servicing has no active HOD/Manager or team member. Assign a Client Servicing person before handover.',
      );
    }

    const superAdmins =
      await this.prisma.user.findMany({
        where: {
          isActive: true,
          deletedAt: null,
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

    for (const admin of superAdmins) {
      recipients.add(admin.id);
    }

    const managedHead =
      departmentPeople.find(
        (person) =>
          person.managedDepartments.length > 0,
      ) ?? null;

    return {
      department,
      headEmployeeId:
        managedHead?.id ??
        department.head?.id ??
        null,
      userIds: Array.from(recipients),
    };
  }

  private async backfillClientServicingHandoverNotifications(
    actorId: string | null,
  ) {
    const handedClients =
      await this.prisma.client.findMany({
        where: {
          deletedAt: null,
          onboardingStage:
            ClientOnboardingStage.APPROVED,
          accountsStage:
            ClientAccountsStage.HANDED_TO_CLIENT_SERVICING,
          clientServicingHandoverAt: {
            not: null,
          },
        },
        select: {
          id: true,
          name: true,
          companyName: true,
        },
        orderBy: {
          clientServicingHandoverAt: 'desc',
        },
        take: 100,
      });

    if (!handedClients.length) {
      return;
    }

    const clientServicing =
      await this.clientServicingRecipients();

    for (const client of handedClients) {
      const existing =
        await this.prisma.notification.findMany({
          where: {
            userId: {
              in: clientServicing.userIds,
            },
            entityType: 'CLIENT',
            entityId: client.id,
            title:
              'Accounts complete · Client Servicing handover',
          },
          select: {
            userId: true,
          },
        });

      const alreadyNotified =
        new Set(
          existing.map((item) => item.userId),
        );

      const missingUserIds =
        clientServicing.userIds.filter(
          (userId) =>
            !alreadyNotified.has(userId),
        );

      if (!missingUserIds.length) {
        continue;
      }

      await this.prisma.notification.createMany({
        data: missingUserIds.map(
          (userId) => ({
            userId,
            actorId,
            kind:
              NotificationKind.USER_MENTIONED,
            title:
              'Accounts complete · Client Servicing handover',
            message:
              `${client.companyName ?? client.name} commercial confirmation is complete. Please start Client Servicing / project setup.`,
            entityType: 'CLIENT',
            entityId: client.id,
            redirectPath:
              '/clients?accountsStage=HANDED_TO_CLIENT_SERVICING',
          }),
        ),
      });
    }
  }

  async updateAccounts(
    id: string,
    dto: UpdateClientAccountsDto,
    access: ClientWorkflowAccessContext,
  ) {
    const workflowAccess =
      await this.requireAccountsAccess(access);

    const client = await this.findOne(id);

    if (
      client.onboardingStage !==
        ClientOnboardingStage.APPROVED ||
      !client.accountsHandoverAt
    ) {
      throw new BadRequestException(
        'Client must be approved by Business Development before Accounts processing can start.',
      );
    }

    const currentStage =
      client.accountsStage ??
      ClientAccountsStage.NEW_HANDOVER;

    const nextStage =
      dto.stage as ClientAccountsStage;

    this.assertAccountsTransition(
      currentStage,
      nextStage,
    );

    const quotationNumber =
      this.clean(dto.quotationNumber) ??
      client.quotationNumber;

    const quotationAmount =
      dto.quotationAmount ??
      client.quotationAmount;

    const quotationDetails =
      this.clean(dto.quotationDetails) ??
      client.quotationDetails;

    const billingDetails =
      this.clean(dto.billingDetails) ??
      client.billingDetails;

    if (
      nextStage ===
        ClientAccountsStage.QUOTATION_PREPARED &&
      !quotationNumber
    ) {
      throw new BadRequestException(
        'Quotation number is required.',
      );
    }

    if (
      nextStage ===
        ClientAccountsStage.AWAITING_CLIENT_CONFIRMATION &&
      !quotationNumber
    ) {
      throw new BadRequestException(
        'Prepare the quotation before marking it as sent.',
      );
    }

    const now = new Date();
    let clientServicing:
      | {
          department: {
            id: string;
            name: string;
          };
          headEmployeeId: string | null;
          userIds: string[];
        }
      | null = null;

    if (
      nextStage ===
      ClientAccountsStage.HANDED_TO_CLIENT_SERVICING
    ) {
      clientServicing =
        await this.clientServicingRecipients();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: {
          id,
        },
        data: {
          accountsStage: nextStage,
          quotationNumber,
          quotationAmount,
          quotationDetails,
          billingDetails,

          ...(nextStage ===
            ClientAccountsStage.QUOTATION_PREPARED && {
            quotationPreparedAt: now,
          }),

          ...(nextStage ===
            ClientAccountsStage.AWAITING_CLIENT_CONFIRMATION && {
            quotationSentAt: now,
          }),

          ...(nextStage ===
            ClientAccountsStage.READY_FOR_CLIENT_SERVICING && {
            clientCommercialConfirmedAt: now,
          }),

          ...(nextStage ===
            ClientAccountsStage.HANDED_TO_CLIENT_SERVICING && {
            clientServicingHandoverAt: now,
            clientServicingId:
              clientServicing?.headEmployeeId ??
              client.clientServicingId,
          }),
        },
      });

      if (
        clientServicing &&
        clientServicing.userIds.length
      ) {
        await tx.notification.createMany({
          data: clientServicing.userIds.map(
            (userId) => ({
              userId,
              actorId: workflowAccess.userId,
              kind: NotificationKind.USER_MENTIONED,
              title: 'Accounts complete · Client Servicing handover',
              message:
                `${client.companyName ?? client.name} commercial confirmation is complete. Please start Client Servicing / project setup.`,
              entityType: 'CLIENT',
              entityId: id,
              redirectPath: '/clients?accountsStage=HANDED_TO_CLIENT_SERVICING',
            }),
          ),
        });
      }
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);

    const projects =
      await this.prisma.project.count({
        where: {
          clientId: id,
          deletedAt: null,
        },
      });

    if (projects > 0) {
      throw new BadRequestException(
        'Client has project records. Deactivate the client instead of deleting it.',
      );
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.clientContact.updateMany({
          where: {
            clientId: id,
            deletedAt: null,
          },

          data: {
            deletedAt: new Date(),
          },
        });

        await tx.client.update({
          where: {
            id,
          },

          data: {
            isActive: false,
            deletedAt: new Date(),
          },
        });
      },
    );

    return {
      success: true,
      message:
        'Client deleted successfully.',
    };
  }

  async addContact(
    clientId: string,
    dto: CreateClientContactDto,
  ) {
    await this.findOne(clientId);

    return this.prisma.$transaction(
      async (tx) => {
        if (dto.isPrimary) {
          await tx.clientContact.updateMany({
            where: {
              clientId,
              deletedAt: null,
            },

            data: {
              isPrimary: false,
            },
          });
        }

        return tx.clientContact.create({
          data: {
            clientId,
            name: dto.name.trim(),

            designation:
              this.clean(
                dto.designation,
              ),

            email:
              this.clean(dto.email),

            phone:
              this.clean(dto.phone),

            isPrimary:
              dto.isPrimary ?? false,
          },
        });
      },
    );
  }

  async updateContact(
    clientId: string,
    contactId: string,
    dto: UpdateClientContactDto,
  ) {
    await this.findOne(clientId);

    const contact =
      await this.prisma.clientContact.findFirst({
        where: {
          id: contactId,
          clientId,
          deletedAt: null,
        },
      });

    if (!contact) {
      throw new NotFoundException(
        'Client contact not found.',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        if (dto.isPrimary === true) {
          await tx.clientContact.updateMany({
            where: {
              clientId,
              deletedAt: null,
              id: {
                not: contactId,
              },
            },

            data: {
              isPrimary: false,
            },
          });
        }

        return tx.clientContact.update({
          where: {
            id: contactId,
          },

          data: {
            ...(dto.name !==
              undefined && {
              name:
                dto.name.trim(),
            }),

            ...(dto.designation !==
              undefined && {
              designation:
                this.clean(
                  dto.designation,
                ),
            }),

            ...(dto.email !==
              undefined && {
              email:
                this.clean(
                  dto.email,
                ),
            }),

            ...(dto.phone !==
              undefined && {
              phone:
                this.clean(
                  dto.phone,
                ),
            }),

            ...(dto.isPrimary !==
              undefined && {
              isPrimary:
                dto.isPrimary,
            }),
          },
        });
      },
    );
  }

  async removeContact(
    clientId: string,
    contactId: string,
  ) {
    await this.findOne(clientId);

    const contact =
      await this.prisma.clientContact.findFirst({
        where: {
          id: contactId,
          clientId,
          deletedAt: null,
        },
      });

    if (!contact) {
      throw new NotFoundException(
        'Client contact not found.',
      );
    }

    await this.prisma.clientContact.update({
      where: {
        id: contactId,
      },

      data: {
        isPrimary: false,
        deletedAt: new Date(),
      },
    });

    return {
      success: true,
      message:
        'Contact deleted successfully.',
    };
  }
}