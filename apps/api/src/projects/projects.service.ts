import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  ClientAccountsStage,
  MilestoneStatus,
  NotificationKind,
  Priority,
  ProjectStatus,
  ProjectReviewStage,
} from '../generated/prisma/enums';

import { PrismaService } from '../prisma/prisma.service';

import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectClientChangesDto, ProjectReviewActionDto } from './dto/project-review-action.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectQueryDto } from './dto/project-query.dto';

import { AddProjectMembersDto } from './dto/add-project-members.dto';
import { RemoveProjectMembersDto } from './dto/remove-project-members.dto';
import { UpdateProjectMemberDto } from './dto/update-project-member.dto';

import { CreateProjectMilestoneDto } from './dto/create-project-milestone.dto';
import { UpdateProjectMilestoneDto } from './dto/update-project-milestone.dto';

type ProjectCreateAccessContext = {
  userId?: string;
  roles?: string[];
};

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private clean(value?: string) {
    return value?.trim() || null;
  }

  private date(value?: string | null) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(
        'Invalid date value.',
      );
    }

    return parsed;
  }

  private normalizeDepartmentName(
    value?: string | null,
  ) {
    return (value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  private isClientServicingDepartment(
    value?: string | null,
  ) {
    const normalized =
      this.normalizeDepartmentName(value);

    return [
      'clientservicing',
      'clientservice',
      'clientservicingdepartment',
      'clientrelations',
      'clientrelationship',
    ].includes(normalized);
  }

  private isWorkflowDepartment(
    value?: string | null,
  ) {
    const normalized =
      this.normalizeDepartmentName(value);

    return [
      'hr',
      'humanresources',
      'businessdevelopment',
      'businessdevelopmentmanager',
      'businessdevelopmentdepartment',
      'bdm',
      'bd',
      'accounts',
      'account',
      'accountsquotation',
      'accountsandquotation',
      'accountsfinance',
      'accountsandfinance',
      'finance',
      'clientservicing',
      'clientservice',
      'clientservicingdepartment',
      'clientrelations',
      'clientrelationship',
    ].includes(normalized);
  }

  private async resolveProjectCreateAccess(
    access: ProjectCreateAccessContext,
  ) {
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
            department: {
              select: {
                id: true,
                name: true,
              },
            },
            managedDepartments: {
              where: {
                isActive: true,
                deletedAt: null,
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

    const clientServicingDepartment =
      departments.find((department) =>
        this.isClientServicingDepartment(
          department.name,
        ),
      ) ?? null;

    return {
      userId: access.userId ?? null,
      employeeId: employee?.id ?? null,
      employeeDepartmentId: employee?.department?.id ?? null,
      canManageAll,
      isClientServicing:
        Boolean(clientServicingDepartment),
      clientServicingDepartment,
    };
  }

  private async assertProjectReviewAccess(
    access: ProjectCreateAccessContext,
  ) {
    const workflowAccess =
      await this.resolveProjectCreateAccess(access);

    if (
      !workflowAccess.canManageAll &&
      !workflowAccess.isClientServicing
    ) {
      throw new ForbiddenException(
        'Project review actions are available only to Client Servicing, Admin or Super Admin.',
      );
    }

    if (!workflowAccess.userId) {
      throw new ForbiddenException('Authenticated user not found.');
    }

    return workflowAccess;
  }

  private async getReviewProject(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
        projectDepartments: {
          include: {
            department: {
              select: {
                id: true,
                name: true,
                headId: true,
                head: {
                  select: {
                    id: true,
                    userId: true,
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
            headId: true,
            head: {
              select: {
                id: true,
                userId: true,
              },
            },
          },
        },
        members: {
          where: { isActive: true },
          select: { employeeId: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    return project;
  }

  private async selectedDepartmentHods(
    departmentIds: string[],
  ) {
    if (!departmentIds.length) {
      throw new BadRequestException(
        'Select at least one relevant project department.',
      );
    }

    const departments =
      await this.prisma.department.findMany({
        where: {
          id: {
            in: departmentIds,
          },
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
              user: {
                select: {
                  isActive: true,
                  deletedAt: true,
                },
              },
            },
          },
        },
      });

    if (departments.length !== departmentIds.length) {
      throw new BadRequestException(
        'One or more selected departments are invalid or inactive.',
      );
    }

    const workflowDepartment =
      departments.find((department) =>
        this.isWorkflowDepartment(
          department.name,
        ),
      );

    if (workflowDepartment) {
      throw new BadRequestException(
        `${workflowDepartment.name} is a workflow department and cannot be selected as an execution department.`,
      );
    }

    const withoutActiveHod =
      departments.find(
        (department) =>
          !department.head ||
          !department.head.user.isActive ||
          department.head.user.deletedAt !== null,
      );

    if (withoutActiveHod) {
      throw new BadRequestException(
        `${withoutActiveHod.name} has no active HOD/Manager. Assign a department HOD before creating the project.`,
      );
    }

    return departments;
  }

  private async validateClient(
    clientId: string,
  ) {
    const client =
      await this.prisma.client.findFirst({
        where: {
          id: clientId,
          deletedAt: null,
          isActive: true,
        },

        select: {
          id: true,
          name: true,
          companyName: true,
          accountsStage: true,
          clientServicingHandoverAt: true,
          clientServicingId: true,
        },
      });

    if (!client) {
      throw new BadRequestException(
        'Client not found or inactive.',
      );
    }

    return client;
  }

  private async validateDepartment(
    departmentId?: string | null,
  ) {
    if (!departmentId) {
      return null;
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
        },
      });

    if (!department) {
      throw new BadRequestException(
        'Department not found or inactive.',
      );
    }

    return department;
  }

  private async validateDepartments(
    departmentIds: string[],
  ) {
    const uniqueIds = [
      ...new Set(
        departmentIds
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ];

    for (const departmentId of uniqueIds) {
      await this.validateDepartment(
        departmentId,
      );
    }

    return uniqueIds;
  }

  private async validateEmployee(
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
        'Employee not found or inactive.',
      );
    }

    return employee;
  }

  private async validateEmployees(
    employeeIds: string[],
  ) {
    if (!employeeIds.length) {
      return;
    }

    const uniqueIds = [
      ...new Set(employeeIds),
    ];

    const count =
      await this.prisma.employeeProfile.count({
        where: {
          id: {
            in: uniqueIds,
          },

          deletedAt: null,

          user: {
            isActive: true,
          },
        },
      });

    if (count !== uniqueIds.length) {
      throw new BadRequestException(
        'One or more employees are invalid or inactive.',
      );
    }
  }

  private async projectReadScope(
    access: ProjectCreateAccessContext = {},
  ): Promise<any> {
    const resolved =
      await this.resolveProjectCreateAccess(access);

    if (
      resolved.canManageAll ||
      resolved.isClientServicing
    ) {
      return {};
    }

    if (!resolved.employeeId) {
      return {
        id: '__NO_PROJECT_ACCESS__',
      };
    }

    const roles = access.roles ?? [];

    if (roles.includes('MANAGER')) {
      return {
        OR: [
          {
            projectManagerId: resolved.employeeId,
          },
          {
            department: {
              headId: resolved.employeeId,
            },
          },
          {
            projectDepartments: {
              some: {
                department: {
                  headId: resolved.employeeId,
                },
              },
            },
          },
          {
            members: {
              some: {
                employeeId: resolved.employeeId,
                isActive: true,
                leftAt: null,
              },
            },
          },
        ],
      };
    }

    return {
      OR: [
        {
          members: {
            some: {
              employeeId: resolved.employeeId,
              isActive: true,
              leftAt: null,
            },
          },
        },
        ...(resolved.employeeDepartmentId
          ? [
              { departmentId: resolved.employeeDepartmentId },
              {
                projectDepartments: {
                  some: {
                    departmentId: resolved.employeeDepartmentId,
                  },
                },
              },
            ]
          : []),
      ],
    };
  }

  async findAll(
    query: ProjectQueryDto,
    access: ProjectCreateAccessContext = {},
  ) {
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

    const accessWhere =
      await this.projectReadScope(access);

    if (Object.keys(accessWhere).length) {
      where.AND = [
        ...(where.AND ?? []),
        accessWhere,
      ];
    }

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },

        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },

        {
          client: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    if (query.clientId) {
      where.clientId =
        query.clientId.trim();
    }

    if (query.departmentId) {
      const departmentId =
        query.departmentId.trim();

      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            {
              departmentId,
            },
            {
              projectDepartments: {
                some: {
                  departmentId,
                },
              },
            },
          ],
        },
      ];
    }

    if (query.projectManagerId) {
      where.projectManagerId =
        query.projectManagerId.trim();
    }

    if (query.status) {
      where.status =
        query.status as ProjectStatus;
    }

    if (query.priority) {
      where.priority =
        query.priority as Priority;
    }

    const direction =
      query.sortOrder === 'asc'
        ? ('asc' as const)
        : ('desc' as const);

    const sortBy =
      query.sortBy ??
      'createdAt';

    const orderBy: any = {
      [sortBy]: direction,
    };

    const [data, total] =
      await Promise.all([
        this.prisma.project.findMany({
          where,
          skip,
          take: limit,
          orderBy,

          include: {
            client: {
              select: {
                id: true,
                name: true,
                companyName: true,
                status: true,
              },
            },

            projectManager: {
              select: {
                id: true,
                employeeId: true,
                fullName: true,
                designation: true,
              },
            },

            department: {
              select: {
                id: true,
                name: true,
              },
            },

            projectDepartments: {
              orderBy: {
                createdAt: 'asc',
              },
              include: {
                department: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },

            members: {
              where: {
                isActive: true,
              },

              include: {
                employee: {
                  select: {
                    id: true,
                    employeeId: true,
                    fullName: true,
                    designation: true,
                  },
                },
              },
            },

            milestones: {
              where: {
                deletedAt: null,
              },

              orderBy: [
                {
                  sortOrder: 'asc',
                },
                {
                  dueDate: 'asc',
                },
              ],
            },

            _count: {
              select: {
                tasks: true,
              },
            },
          },
        }),

        this.prisma.project.count({
          where,
        }),
      ]);

    const projects =
      data.map((project) => {
        const milestoneTotal =
          project.milestones.length;

        const completedMilestones =
          project.milestones.filter(
            (milestone) =>
              milestone.status ===
              MilestoneStatus.COMPLETED,
          ).length;

        const progress =
          milestoneTotal > 0
            ? Math.round(
                (completedMilestones /
                  milestoneTotal) *
                  100,
              )
            : project.status ===
                ProjectStatus.COMPLETED
              ? 100
              : 0;

        const departments =
          project.projectDepartments.length
            ? project.projectDepartments.map(
                (link) => link.department,
              )
            : project.department
              ? [project.department]
              : [];

        return {
          ...project,
          departments,

          taskCount:
            project._count.tasks,

          progress,
        };
      });

    return {
      data: projects,

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
    const project =
      await this.prisma.project.findFirst({
        where: {
          id,
          deletedAt: null,
        },

        include: {
          client: true,

          projectManager: {
            select: {
              id: true,
              employeeId: true,
              fullName: true,
              designation: true,
            },
          },

          department: {
            select: {
              id: true,
              name: true,
            },
          },

          projectDepartments: {
            orderBy: {
              createdAt: 'asc',
            },
            include: {
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },

          members: {
            where: {
              isActive: true,
            },

            include: {
              employee: {
                select: {
                  id: true,
                  employeeId: true,
                  fullName: true,
                  designation: true,
                },
              },
            },

            orderBy: {
              joinedAt: 'asc',
            },
          },

          milestones: {
            where: {
              deletedAt: null,
            },

            orderBy: [
              {
                sortOrder: 'asc',
              },
              {
                dueDate: 'asc',
              },
            ],
          },

          _count: {
            select: {
              tasks: true,
            },
          },
        },
      });

    if (!project) {
      throw new NotFoundException(
        'Project not found.',
      );
    }

    const milestoneTotal =
      project.milestones.length;

    const completedMilestones =
      project.milestones.filter(
        (milestone) =>
          milestone.status ===
          MilestoneStatus.COMPLETED,
      ).length;

    const progress =
      milestoneTotal > 0
        ? Math.round(
            (completedMilestones /
              milestoneTotal) *
              100,
          )
        : project.status ===
            ProjectStatus.COMPLETED
          ? 100
          : 0;

    const departments =
      project.projectDepartments.length
        ? project.projectDepartments.map(
            (link) => link.department,
          )
        : project.department
          ? [project.department]
          : [];

    return {
      ...project,
      departments,
      taskCount:
        project._count.tasks,
      progress,
    };
  }

  async create(
    dto: CreateProjectDto,
    access: ProjectCreateAccessContext = {},
  ) {
    const workflowAccess =
      await this.resolveProjectCreateAccess(
        access,
      );

    if (
      !workflowAccess.canManageAll &&
      !workflowAccess.isClientServicing
    ) {
      throw new ForbiddenException(
        'New projects can be created only by Client Servicing, Admin or Super Admin.',
      );
    }

    const clientId =
      dto.clientId.trim();

    const client =
      await this.validateClient(
        clientId,
      );

    if (
      !workflowAccess.canManageAll &&
      (
        client.accountsStage !==
          ClientAccountsStage.HANDED_TO_CLIENT_SERVICING ||
        !client.clientServicingHandoverAt
      )
    ) {
      throw new BadRequestException(
        'This client has not been handed over to Client Servicing by Accounts yet.',
      );
    }

    const requestedProjectManagerId =
      this.clean(
        dto.projectManagerId,
      );

    const projectManagerId =
      requestedProjectManagerId ??
      (
        workflowAccess.isClientServicing
          ? workflowAccess.employeeId
          : null
      );

    const requestedDepartmentIds =
      dto.departmentIds !== undefined
        ? dto.departmentIds
        : dto.departmentId
          ? [dto.departmentId]
          : [];

    const departmentIds =
      await this.validateDepartments(
        requestedDepartmentIds,
      );

    const selectedDepartments =
      await this.selectedDepartmentHods(
        departmentIds,
      );

    const departmentId =
      departmentIds[0] ?? null;

    const memberIds = [
      ...new Set(
        dto.memberIds?.map(
          (id) => id.trim(),
        ) ?? [],
      ),
    ].filter(Boolean);

    await this.validateEmployee(
      projectManagerId,
    );

    await this.validateEmployees(
      memberIds,
    );

    const startDate =
      new Date();

    const deadline =
      this.date(dto.deadline);

    const creationDay =
      new Date(startDate);

    creationDay.setHours(
      0,
      0,
      0,
      0,
    );

    if (
      deadline &&
      deadline < creationDay
    ) {
      throw new BadRequestException(
        'Deadline cannot be before the project creation date.',
      );
    }

    const project =
      await this.prisma.$transaction(
        async (tx) => {
          const created =
            await tx.project.create({
              data: {
                name: dto.name.trim(),
                clientId,

                description:
                  this.clean(
                    dto.description,
                  ),

                internalNotes:
                  this.clean(
                    dto.internalNotes,
                  ),

                projectManagerId,
                departmentId,

                // Start date is always the project creation time.
                startDate,
                deadline,

                // Project priority is system-managed and always HIGH.
                priority:
                  Priority.HIGH,

                // PLANNING is retained as the internal compatibility code.
                // The workspace presents this initial state as TO DO.
                status:
                  ProjectStatus.PLANNING,

                voiceTranscript:
                  this.clean(
                    dto.voiceTranscript,
                  ),

                voiceLanguage:
                  this.clean(
                    dto.voiceLanguage,
                  ),

                projectDepartments: {
                  create:
                    departmentIds.map(
                      (
                        selectedDepartmentId,
                      ) => ({
                        departmentId:
                          selectedDepartmentId,
                      }),
                    ),
                },

                members:
                  memberIds.length
                    ? {
                        create:
                          memberIds.map(
                            (
                              employeeId,
                            ) => ({
                              employeeId,
                            }),
                          ),
                      }
                    : undefined,
              },
            });

          if (
            workflowAccess.isClientServicing &&
            workflowAccess.employeeId &&
            !client.clientServicingId
          ) {
            await tx.client.update({
              where: {
                id: clientId,
              },
              data: {
                clientServicingId:
                  workflowAccess.employeeId,
              },
            });
          }

          const departmentsByUser =
            new Map<string, string[]>();

          for (
            const department
            of selectedDepartments
          ) {
            const userId =
              department.head!.userId;

            const names =
              departmentsByUser.get(
                userId,
              ) ?? [];

            names.push(
              department.name,
            );

            departmentsByUser.set(
              userId,
              names,
            );
          }

          if (
            departmentsByUser.size
          ) {
            await tx.notification.createMany({
              data: Array.from(
                departmentsByUser.entries(),
              ).map(
                ([
                  userId,
                  departmentNames,
                ]) => ({
                  userId,
                  actorId:
                    workflowAccess.userId,
                  kind:
                    NotificationKind.USER_MENTIONED,
                  title:
                    'New project assigned to your department',
                  message:
                    `${created.name} for ${client.companyName ?? client.name} has been assigned to ${departmentNames.join(', ')}. Please review the brief and start department work.`,
                  entityType:
                    'PROJECT',
                  entityId:
                    created.id,
                  redirectPath:
                    '/projects',
                }),
              ),
            });
          }

          return created;
        },
      );

    return this.findOne(
      project.id,
    );
  }

  async update(
    id: string,
    dto: UpdateProjectDto,
  ) {
    if (
      dto.status ===
      ProjectStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'Project completion is not used in the active workflow. Complete tasks and move the project through review instead.',
      );
    }

    const current =
      await this.findOne(id);

    let clientId:
      | string
      | undefined;

    let projectManagerId:
      | string
      | null
      | undefined;

    let departmentIds:
      | string[]
      | undefined;

    if (dto.clientId !== undefined) {
      clientId =
        dto.clientId.trim();

      await this.validateClient(
        clientId,
      );
    }

    if (
      dto.projectManagerId !==
      undefined
    ) {
      projectManagerId =
        this.clean(
          dto.projectManagerId,
        );

      await this.validateEmployee(
        projectManagerId,
      );
    }

    if (
      dto.departmentIds !==
        undefined ||
      dto.departmentId !==
        undefined
    ) {
      const requested =
        dto.departmentIds !==
        undefined
          ? dto.departmentIds
          : dto.departmentId
            ? [dto.departmentId]
            : [];

      departmentIds =
        await this.validateDepartments(
          requested,
        );
    }

    const deadline =
      dto.deadline !== undefined
        ? this.date(dto.deadline)
        : current.deadline;

    const creationDay =
      current.startDate
        ? new Date(
            current.startDate,
          )
        : null;

    creationDay?.setHours(
      0,
      0,
      0,
      0,
    );

    if (
      deadline &&
      creationDay &&
      deadline <
        creationDay
    ) {
      throw new BadRequestException(
        'Deadline cannot be before the project creation date.',
      );
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.project.update({
          where: {
            id,
          },

          data: {
            ...(dto.name !== undefined && {
              name: dto.name.trim(),
            }),

            ...(dto.clientId !==
              undefined && {
              clientId,
            }),

            ...(dto.description !==
              undefined && {
              description:
                this.clean(
                  dto.description,
                ),
            }),

            ...(dto.internalNotes !==
              undefined && {
              internalNotes:
                this.clean(
                  dto.internalNotes,
                ),
            }),

            ...(dto.projectManagerId !==
              undefined && {
              projectManagerId,
            }),

            ...(departmentIds !==
              undefined && {
              departmentId:
                departmentIds[0] ??
                null,
            }),

            ...(dto.deadline !==
              undefined && {
              deadline,
            }),

            // Project priority remains system-managed on every update.
            priority:
              Priority.HIGH,

            ...(dto.status !==
              undefined && {
              status:
                dto.status as ProjectStatus,
            }),

            ...(dto.voiceTranscript !==
              undefined && {
              voiceTranscript:
                this.clean(
                  dto.voiceTranscript,
                ),
            }),

            ...(dto.voiceLanguage !==
              undefined && {
              voiceLanguage:
                this.clean(
                  dto.voiceLanguage,
                ),
            }),
          },
        });

        if (
          departmentIds !== undefined
        ) {
          await tx.projectDepartment.deleteMany({
            where: {
              projectId: id,
            },
          });

          if (
            departmentIds.length
          ) {
            await tx.projectDepartment.createMany({
              data:
                departmentIds.map(
                  (
                    selectedDepartmentId,
                  ) => ({
                    projectId: id,
                    departmentId:
                      selectedDepartmentId,
                  }),
                ),
              skipDuplicates: true,
            });
          }
        }
      },
    );

    return this.findOne(id);
  }

  async sendToClient(
    projectId: string,
    dto: ProjectReviewActionDto,
    access: ProjectCreateAccessContext = {},
  ) {
    const workflowAccess =
      await this.assertProjectReviewAccess(access);

    const project =
      await this.getReviewProject(projectId);

    const reviewReadyStatus =
      project.status === ProjectStatus.UNDER_REVIEW ||
      (!project.deadline && project.status === ProjectStatus.ACTIVE);

    if (!reviewReadyStatus) {
      throw new BadRequestException(
        'Project must be ready for review before it can be sent to the client.',
      );
    }

    if (
      project.reviewStage &&
      project.reviewStage !== ProjectReviewStage.CLIENT_SERVICING_REVIEW
    ) {
      throw new BadRequestException(
        'Project is not waiting for Client Servicing review.',
      );
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        reviewStage: ProjectReviewStage.CLIENT_REVIEW,
        clientReviewSentAt: new Date(),
      },
    });

    return this.findOne(projectId);
  }

  async clientApproved(
    projectId: string,
    dto: ProjectReviewActionDto,
    access: ProjectCreateAccessContext = {},
  ) {
    const workflowAccess =
      await this.assertProjectReviewAccess(access);

    const project =
      await this.getReviewProject(projectId);

    if (
      !(project.status === ProjectStatus.UNDER_REVIEW || project.status === ProjectStatus.ACTIVE) ||
      project.reviewStage !== ProjectReviewStage.CLIENT_REVIEW
    ) {
      throw new BadRequestException(
        'Project is not waiting for client approval.',
      );
    }

    const now = new Date();

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        // Client approval closes the current review cycle, not the project.
        // The project remains active for its continuing/future department work.
        status: ProjectStatus.ACTIVE,
        reviewStage: null,
        clientApprovedAt: now,
        clientFeedbackDepartmentIds: [],
      },
    });

    const departmentEmployeeIds = [
      ...project.projectDepartments
        .map((item) => item.department.headId)
        .filter((id): id is string => Boolean(id)),
      ...(project.department?.headId ? [project.department.headId] : []),
    ];

    const taskAssignees =
      await this.prisma.taskAssignee.findMany({
        where: {
          removedAt: null,
          task: {
            projectId,
            deletedAt: null,
          },
        },
        select: { employeeId: true },
      });

    const recipientEmployeeIds = [
      ...new Set([
        ...departmentEmployeeIds,
        ...project.members.map((member) => member.employeeId),
        ...taskAssignees.map((item) => item.employeeId),
        ...(project.projectManagerId ? [project.projectManagerId] : []),
      ]),
    ];

    await this.notifications.notifyEmployees(
      recipientEmployeeIds,
      {
        actorId: workflowAccess.userId,
        kind: NotificationKind.USER_MENTIONED,
        title: 'Client approved project work',
        message: `${project.name} has been approved by the client. The project remains active for the next work cycle.`,
        entityType: 'PROJECT',
        entityId: projectId,
        redirectPath: '/projects',
      },
    );

    return this.findOne(projectId);
  }

  async clientChanges(
    projectId: string,
    dto: ProjectClientChangesDto,
    access: ProjectCreateAccessContext = {},
  ) {
    const workflowAccess =
      await this.assertProjectReviewAccess(access);

    const project =
      await this.getReviewProject(projectId);

    if (
      !(project.status === ProjectStatus.UNDER_REVIEW || project.status === ProjectStatus.ACTIVE) ||
      project.reviewStage !== ProjectReviewStage.CLIENT_REVIEW
    ) {
      throw new BadRequestException(
        'Project is not waiting for client feedback.',
      );
    }

    const note = dto.note.trim();
    if (!note) {
      throw new BadRequestException('Client feedback is required.');
    }

    const selectedIds = [
      ...new Set(dto.departmentIds.map((id) => id.trim()).filter(Boolean)),
    ];

    if (!selectedIds.length) {
      throw new BadRequestException(
        'Select at least one department for the requested changes.',
      );
    }

    const projectDepartments = project.projectDepartments.length
      ? project.projectDepartments.map((item) => item.department)
      : project.department
        ? [project.department]
        : [];

    const projectDepartmentIds = new Set(
      projectDepartments.map((department) => department.id),
    );

    const invalidId = selectedIds.find(
      (id) => !projectDepartmentIds.has(id),
    );

    if (invalidId) {
      throw new BadRequestException(
        'Changes can be routed only to departments assigned to this project.',
      );
    }

    const selectedDepartments = projectDepartments.filter(
      (department) => selectedIds.includes(department.id),
    );

    const missingHod = selectedDepartments.find(
      (department) => !department.headId,
    );

    if (missingHod) {
      throw new BadRequestException(
        `${missingHod.name} does not have an active HOD.`,
      );
    }

    const now = new Date();

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.ACTIVE,
        reviewStage: ProjectReviewStage.CHANGES_REQUIRED,
        clientFeedback: note,
        clientFeedbackAt: now,
        clientFeedbackDepartmentIds: selectedIds,
      },
    });

    const hodEmployeeIds = selectedDepartments
      .map((department) => department.headId)
      .filter((id): id is string => Boolean(id));

    await this.notifications.notifyEmployees(
      hodEmployeeIds,
      {
        actorId: workflowAccess.userId,
        kind: NotificationKind.USER_MENTIONED,
        title: 'Client changes required',
        message: `${project.name}: ${note}`,
        entityType: 'PROJECT',
        entityId: projectId,
        redirectPath: '/projects',
      },
    );

    return this.findOne(projectId);
  }

  async remove(id: string) {
    await this.findOne(id);

    const taskCount =
      await this.prisma.task.count({
        where: {
          projectId: id,
          deletedAt: null,
        },
      });

    if (taskCount > 0) {
      throw new BadRequestException(
        'Project contains task records. Archive the project instead of deleting it.',
      );
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.projectMember.updateMany({
          where: {
            projectId: id,
            isActive: true,
          },

          data: {
            isActive: false,
            leftAt: new Date(),
          },
        });

        await tx.projectMilestone.updateMany({
          where: {
            projectId: id,
            deletedAt: null,
          },

          data: {
            deletedAt: new Date(),
          },
        });

        await tx.project.update({
          where: {
            id,
          },

          data: {
            deletedAt: new Date(),
            status:
              ProjectStatus.ARCHIVED,
          },
        });
      },
    );

    return {
      success: true,
      message:
        'Project deleted successfully.',
    };
  }

  async addMembers(
    projectId: string,
    dto: AddProjectMembersDto,
  ) {
    await this.findOne(projectId);

    const employeeIds = [
      ...new Set(
        dto.employeeIds.map(
          (id) => id.trim(),
        ),
      ),
    ].filter(Boolean);

    await this.validateEmployees(
      employeeIds,
    );

    await this.prisma.$transaction(
      employeeIds.map(
        (employeeId) =>
          this.prisma.projectMember.upsert({
            where: {
              projectId_employeeId: {
                projectId,
                employeeId,
              },
            },

            create: {
              projectId,
              employeeId,

              memberRole:
                this.clean(
                  dto.memberRole,
                ),
            },

            update: {
              memberRole:
                this.clean(
                  dto.memberRole,
                ),

              isActive: true,
              leftAt: null,
              joinedAt: new Date(),
            },
          }),
      ),
    );

    return this.findOne(projectId);
  }

  async removeMembers(
    projectId: string,
    dto: RemoveProjectMembersDto,
  ) {
    await this.findOne(projectId);

    await this.prisma.projectMember.updateMany({
      where: {
        projectId,

        employeeId: {
          in: dto.employeeIds,
        },

        isActive: true,
      },

      data: {
        isActive: false,
        leftAt: new Date(),
      },
    });

    return this.findOne(projectId);
  }

  async updateMember(
    projectId: string,
    employeeId: string,
    dto: UpdateProjectMemberDto,
  ) {
    await this.findOne(projectId);

    const membership =
      await this.prisma.projectMember.findUnique({
        where: {
          projectId_employeeId: {
            projectId,
            employeeId,
          },
        },
      });

    if (
      !membership ||
      !membership.isActive
    ) {
      throw new NotFoundException(
        'Active project member not found.',
      );
    }

    await this.prisma.projectMember.update({
      where: {
        projectId_employeeId: {
          projectId,
          employeeId,
        },
      },

      data: {
        memberRole:
          this.clean(
            dto.memberRole,
          ),
      },
    });

    return this.findOne(projectId);
  }

  async createMilestone(
    projectId: string,
    dto: CreateProjectMilestoneDto,
  ) {
    await this.findOne(projectId);

    const status =
      (dto.status as MilestoneStatus) ??
      MilestoneStatus.PENDING;

    await this.prisma.projectMilestone.create({
      data: {
        projectId,

        title:
          dto.title.trim(),

        description:
          this.clean(
            dto.description,
          ),

        dueDate:
          this.date(dto.dueDate),

        status,

        completedAt:
          status ===
          MilestoneStatus.COMPLETED
            ? new Date()
            : null,

        sortOrder:
          dto.sortOrder ?? 0,
      },
    });

    return this.findOne(projectId);
  }

  async updateMilestone(
    projectId: string,
    milestoneId: string,
    dto: UpdateProjectMilestoneDto,
  ) {
    await this.findOne(projectId);

    const milestone =
      await this.prisma.projectMilestone.findFirst({
        where: {
          id: milestoneId,
          projectId,
          deletedAt: null,
        },
      });

    if (!milestone) {
      throw new NotFoundException(
        'Milestone not found.',
      );
    }

    const status =
      dto.status !== undefined
        ? (dto.status as MilestoneStatus)
        : milestone.status;

    await this.prisma.projectMilestone.update({
      where: {
        id: milestoneId,
      },

      data: {
        ...(dto.title !== undefined && {
          title:
            dto.title.trim(),
        }),

        ...(dto.description !==
          undefined && {
          description:
            this.clean(
              dto.description,
            ),
        }),

        ...(dto.dueDate !==
          undefined && {
          dueDate:
            this.date(
              dto.dueDate,
            ),
        }),

        ...(dto.status !==
          undefined && {
          status,

          completedAt:
            status ===
            MilestoneStatus.COMPLETED
              ? milestone.completedAt ??
                new Date()
              : null,
        }),

        ...(dto.sortOrder !==
          undefined && {
          sortOrder:
            dto.sortOrder,
        }),
      },
    });

    return this.findOne(projectId);
  }

  async removeMilestone(
    projectId: string,
    milestoneId: string,
  ) {
    await this.findOne(projectId);

    const milestone =
      await this.prisma.projectMilestone.findFirst({
        where: {
          id: milestoneId,
          projectId,
          deletedAt: null,
        },
      });

    if (!milestone) {
      throw new NotFoundException(
        'Milestone not found.',
      );
    }

    await this.prisma.projectMilestone.update({
      where: {
        id: milestoneId,
      },

      data: {
        deletedAt: new Date(),
      },
    });

    return this.findOne(projectId);
  }
}