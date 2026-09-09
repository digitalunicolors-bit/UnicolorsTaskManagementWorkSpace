import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  ApprovalStatus,
  NotificationKind,
  ProjectStatus,
  ProjectReviewStage,
  TimeEntryStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

import { MoveKanbanTaskDto } from './dto/move-kanban-task.dto';
import { NotificationsService } from './notifications.service';

type BoardQuery = {
  search?: string;
  clientId?: string;
  projectId?: string;
  assigneeId?: string;
  priority?: string;
};

type UserContext = {
  roles: string[];
  permissions: Set<string>;
  employeeId: string | null;
};

@Injectable()
export class KanbanService {
  private readonly boardCodes = [
    'TODO',
    'TO_DO',
    'IN_PROGRESS',
    'REVIEW',
    'INTERNAL_REVIEW',
    'CLIENT_REVIEW',
    'UNDER_REVIEW',
    'CHANGES_REQUESTED',
    'DONE',
    'COMPLETED',
  ];

  private readonly completedCodes = [
    'DONE',
    'COMPLETED',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async syncProjectStatusFromTasks(
    projectId: string,
  ) {
    const project =
      await this.prisma.project.findFirst({
        where: {
          id: projectId,
          deletedAt: null,
        },
        select: {
          status: true,
          reviewStage: true,
          name: true,
          projectManagerId: true,
        },
      });

    if (
      !project ||
      project.status === ProjectStatus.COMPLETED ||
      project.status === ProjectStatus.CANCELLED ||
      project.status === ProjectStatus.ARCHIVED
    ) {
      return;
    }

    const tasks =
      await this.prisma.task.findMany({
        where: {
          projectId,
          deletedAt: null,
          isDraft: false,
        },
        select: {
          status: {
            select: {
              code: true,
            },
          },
        },
      });

    if (!tasks.length) {
      return;
    }

    const codes =
      tasks.map(
        (item) =>
          item.status.code,
      );

    const doneCodes = [
      'DONE',
      'COMPLETED',
    ];

    let nextStatus:
      | ProjectStatus
      | null = null;
    let nextReviewStage:
      | ProjectReviewStage
      | null
      | undefined = undefined;

    if (
      codes.every((code) =>
        doneCodes.includes(code),
      ) &&
      project.reviewStage !== ProjectReviewStage.CLIENT_REVIEW
    ) {
      nextStatus = ProjectStatus.UNDER_REVIEW;
      nextReviewStage = ProjectReviewStage.CLIENT_SERVICING_REVIEW;
    } else if (
      codes.some((code) =>
        [
          'IN_PROGRESS',
          'CHANGES_REQUESTED',
        ].includes(code),
      ) ||
      (
        project.status === ProjectStatus.UNDER_REVIEW &&
        project.reviewStage !== ProjectReviewStage.CLIENT_REVIEW &&
        codes.some((code) => !doneCodes.includes(code))
      )
    ) {
      nextStatus = ProjectStatus.ACTIVE;
      nextReviewStage = null;
    }

    const reviewStageChanged =
      nextReviewStage !== undefined &&
      nextReviewStage !== project.reviewStage;

    if (
      nextStatus &&
      (nextStatus !== project.status || reviewStageChanged)
    ) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          status: nextStatus,
          ...(nextReviewStage !== undefined
            ? { reviewStage: nextReviewStage }
            : {}),
        },
      });

      if (
        nextReviewStage === ProjectReviewStage.CLIENT_SERVICING_REVIEW &&
        project.reviewStage !== ProjectReviewStage.CLIENT_SERVICING_REVIEW &&
        project.projectManagerId
      ) {
        await this.notifications.notifyEmployees(
          [project.projectManagerId],
          {
            kind:
              NotificationKind.USER_MENTIONED,
            title:
              'Project ready for review',
            message:
              `${project.name} is ready for Client Servicing review.`,
            entityType:
              'PROJECT',
            entityId:
              projectId,
            redirectPath:
              '/projects',
          },
        );
      }
    }
  }

  private clean(
    value?: string | null,
  ) {
    if (
      value === undefined ||
      value === null
    ) {
      return null;
    }

    const text =
      value.trim();

    return text || null;
  }

  private async context(
    userId: string,
  ): Promise<UserContext> {
    const [
      userRoles,
      employee,
    ] =
      await Promise.all([
        this.prisma.userRole.findMany({
          where: {
            userId,
          },
          select: {
            role: {
              select: {
                name: true,
                permissions: {
                  select: {
                    permission: {
                      select: {
                        code: true,
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        this.prisma.employeeProfile.findFirst({
          where: {
            userId,
            deletedAt: null,
          },
          select: {
            id: true,
          },
        }),
      ]);

    const roles =
      userRoles.map(
        (item) =>
          item.role.name,
      );

    const permissions =
      new Set<string>();

    for (const item of userRoles) {
      for (
        const rolePermission
        of item.role.permissions
      ) {
        permissions.add(
          rolePermission.permission.code,
        );
      }
    }

    return {
      roles,
      permissions,
      employeeId:
        employee?.id ??
        null,
    };
  }

  private requirePermission(
    ctx: UserContext,
    code: string,
  ) {
    if (
      ctx.roles.includes(
        'SUPER_ADMIN',
      ) ||
      ctx.permissions.has(
        code,
      )
    ) {
      return;
    }

    throw new ForbiddenException(
      `Permission "${code}" is required for this move.`,
    );
  }

  private async taskScope(
    userId: string,
    ctx?: UserContext,
  ): Promise<any> {
    const userContext =
      ctx ??
      await this.context(
        userId,
      );

    if (
      userContext.roles.includes(
        'SUPER_ADMIN',
      ) ||
      userContext.roles.includes(
        'ADMIN',
      )
    ) {
      return {};
    }

    if (
      !userContext.employeeId
    ) {
      return {
        id:
          '__NO_TASK_ACCESS__',
      };
    }

    if (
      userContext.roles.includes(
        'MANAGER',
      )
    ) {
      const directReports =
        await this.prisma.employeeProfile.findMany({
          where: {
            reportingManagerId:
              userContext.employeeId,
            deletedAt: null,
          },
          select: {
            id: true,
          },
        });

      const teamEmployeeIds = [
        userContext.employeeId,
        ...directReports.map(
          (item) =>
            item.id,
        ),
      ];

      const managedProjects =
        await this.prisma.project.findMany({
          where: {
            projectManagerId:
              userContext.employeeId,
            deletedAt: null,
          },
          select: {
            id: true,
          },
        });

      return {
        OR: [
          {
            projectId: {
              in:
                managedProjects.map(
                  (item) =>
                    item.id,
                ),
            },
          },
          {
            assignees: {
              some: {
                employeeId: {
                  in:
                    teamEmployeeIds,
                },
                removedAt:
                  null,
              },
            },
          },
          {
            collaborators: {
              some: {
                employeeId: {
                  in:
                    teamEmployeeIds,
                },
                removedAt:
                  null,
              },
            },
          },
          {
            reviewers: {
              some: {
                employeeId:
                  userContext.employeeId,
              },
            },
          },
        ],
      };
    }

    return {
      OR: [
        {
          assignees: {
            some: {
              employeeId:
                userContext.employeeId,
              removedAt:
                null,
            },
          },
        },
        {
          collaborators: {
            some: {
              employeeId:
                userContext.employeeId,
              removedAt:
                null,
            },
          },
        },
      ],
    };
  }

  private scopedWhere(
    base: any,
    scope: any,
  ) {
    if (
      Object.keys(
        scope,
      ).length === 0
    ) {
      return base;
    }

    return {
      AND: [
        base,
        scope,
      ],
    };
  }

  private columnCode(
    statusCode: string,
  ):
    | 'TODO'
    | 'IN_PROGRESS'
    | 'REVIEW'
    | 'CHANGES_REQUESTED'
    | 'DONE'
    | null {
    if (
      statusCode ===
        'TODO' ||
      statusCode ===
        'TO_DO'
    ) {
      return 'TODO';
    }

    if (
      statusCode ===
      'IN_PROGRESS'
    ) {
      return 'IN_PROGRESS';
    }

    if (
      [
        'REVIEW',
        'INTERNAL_REVIEW',
        'CLIENT_REVIEW',
        'UNDER_REVIEW',
      ].includes(
        statusCode,
      )
    ) {
      return 'REVIEW';
    }

    if (
      statusCode ===
      'CHANGES_REQUESTED'
    ) {
      return 'CHANGES_REQUESTED';
    }

    if (
      this.completedCodes.includes(
        statusCode,
      )
    ) {
      return 'DONE';
    }

    return null;
  }

  private loggedSeconds(
    entries: Array<{
      status: TimeEntryStatus;
      durationSeconds: number;
      activeStartedAt: Date | null;
    }>,
  ) {
    const now =
      Date.now();

    return entries.reduce(
      (
        total,
        entry,
      ) => {
        let seconds =
          entry.durationSeconds;

        if (
          entry.status ===
            TimeEntryStatus.RUNNING &&
          entry.activeStartedAt
        ) {
          seconds +=
            Math.max(
              0,
              Math.floor(
                (
                  now -
                  entry.activeStartedAt.getTime()
                ) /
                  1000,
              ),
            );
        }

        return (
          total +
          seconds
        );
      },
      0,
    );
  }

  private serializeTask(
    task: any,
  ) {
    const column =
      this.columnCode(
        task.status.code,
      );

    const totalSubtasks =
      task.subtasks.length;

    const completedSubtasks =
      task.subtasks.filter(
        (item: any) =>
          item.isCompleted,
      ).length;

    const loggedSeconds =
      this.loggedSeconds(
        task.timeEntries,
      );

    const done =
      this.completedCodes.includes(
        task.status.code,
      );

    return {
      id:
        task.id,
      title:
        task.title,
      description:
        task.description,
      priority:
        task.priority,
      dueAt:
        task.dueAt,
      estimatedHours:
        task.estimatedHours
          ? Number(
              task.estimatedHours,
            )
          : 0,
      isCritical:
        task.isCritical,
      status:
        task.status,
      column,
      client:
        task.client,
      project:
        task.project,
      category:
        task.category,
      department:
        task.department,
      assignees:
        task.assignees.map(
          (item: any) => ({
            ...item.employee,
            isPrimary:
              item.isPrimary,
          }),
        ),
      reviewers:
        task.reviewers.map(
          (item: any) =>
            item.employee,
        ),
      subtaskProgress: {
        completed:
          completedSubtasks,
        total:
          totalSubtasks,
        percent:
          totalSubtasks
            ? Math.round(
                (
                  completedSubtasks /
                  totalSubtasks
                ) *
                  100,
              )
            : 0,
      },
      attachmentCount:
        task.files.length,
      commentCount:
        task.comments.length,
      loggedSeconds,
      loggedHours:
        Number(
          (
            loggedSeconds /
            3600
          ).toFixed(
            2,
          ),
        ),
      isOverdue:
        Boolean(
          task.dueAt &&
          new Date(
            task.dueAt,
          ).getTime() <
            Date.now() &&
          !done,
        ),
      updatedAt:
        task.updatedAt,
    };
  }

  private taskSelect(): any {
    return {
      id: true,
      title: true,
      description: true,
      priority: true,
      dueAt: true,
      estimatedHours: true,
      isCritical: true,
      updatedAt: true,
      createdById: true,
      isDraft: true,
      statusId: true,

      client: {
        select: {
          id: true,
          name: true,
          companyName: true,
        },
      },

      project: {
        select: {
          id: true,
          name: true,
        },
      },

      department: {
        select: {
          id: true,
          name: true,
        },
      },

      category: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },

      status: {
        select: {
          id: true,
          code: true,
          name: true,
          color: true,
          sortOrder: true,
        },
      },

      assignees: {
        where: {
          removedAt: null,
        },
        orderBy: [
          {
            isPrimary:
              'desc' as const,
          },
          {
            assignedAt:
              'asc' as const,
          },
        ],
        select: {
          isPrimary: true,
          employeeId: true,
          employee: {
            select: {
              id: true,
              employeeId: true,
              username: true,
              fullName: true,
              designation: true,
              profileImageUrl: true,
            },
          },
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
        orderBy: {
          sortOrder:
            'asc' as const,
        },
        select: {
          employeeId: true,
          isRequired: true,
          employee: {
            select: {
              id: true,
              employeeId: true,
              username: true,
              fullName: true,
              designation: true,
              profileImageUrl: true,
            },
          },
        },
      },

      subtasks: {
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
          isCompleted: true,
        },
      },

      comments: {
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
        },
      },

      files: {
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
        },
      },

      timeEntries: {
        where: {
          deletedAt: null,
        },
        select: {
          status: true,
          durationSeconds: true,
          activeStartedAt: true,
        },
      },
    } as const;
  }

  async options(
    userId: string,
  ) {
    const ctx =
      await this.context(
        userId,
      );

    const scope =
      await this.taskScope(
        userId,
        ctx,
      );

    const where =
      this.scopedWhere(
        {
          deletedAt: null,
          isDraft: false,
          status: {
            code: {
              in:
                this.boardCodes,
            },
          },
        },
        scope,
      );

    const tasks =
      await this.prisma.task.findMany({
        where,
        select: {
          client: {
            select: {
              id: true,
              name: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              clientId: true,
            },
          },
          assignees: {
            where: {
              removedAt: null,
            },
            select: {
              employee: {
                select: {
                  id: true,
                  fullName: true,
                  username: true,
                  profileImageUrl: true,
                },
              },
            },
          },
        },
        take: 5000,
      });

    const clients =
      new Map<
        string,
        {
          id: string;
          name: string;
        }
      >();

    const projects =
      new Map<
        string,
        {
          id: string;
          name: string;
          clientId: string;
        }
      >();

    const employees =
      new Map<
        string,
        {
          id: string;
          fullName: string;
          username:
            | string
            | null;
          profileImageUrl:
            | string
            | null;
        }
      >();

    for (const task of tasks) {
      clients.set(
        task.client.id,
        task.client,
      );

      projects.set(
        task.project.id,
        task.project,
      );

      for (
        const assignment
        of task.assignees
      ) {
        employees.set(
          assignment.employee.id,
          assignment.employee,
        );
      }
    }

    return {
      clients:
        [...clients.values()].sort(
          (
            a,
            b,
          ) =>
            a.name.localeCompare(
              b.name,
            ),
        ),
      projects:
        [...projects.values()].sort(
          (
            a,
            b,
          ) =>
            a.name.localeCompare(
              b.name,
            ),
        ),
      employees:
        [...employees.values()].sort(
          (
            a,
            b,
          ) =>
            a.fullName.localeCompare(
              b.fullName,
            ),
        ),
      priorities: [
        'LOW',
        'MEDIUM',
        'HIGH',
        'URGENT',
      ],
    };
  }

  async board(
    userId: string,
    query: BoardQuery,
  ) {
    const ctx =
      await this.context(
        userId,
      );

    const scope =
      await this.taskScope(
        userId,
        ctx,
      );

    const base: any = {
      deletedAt: null,
      isDraft: false,
      status: {
        code: {
          in:
            this.boardCodes,
        },
      },
    };

    if (
      query.search?.trim()
    ) {
      const search =
        query.search.trim();

      base.OR = [
        {
          title: {
            contains:
              search,
            mode:
              'insensitive',
          },
        },
        {
          client: {
            name: {
              contains:
                search,
              mode:
                'insensitive',
            },
          },
        },
        {
          project: {
            name: {
              contains:
                search,
              mode:
                'insensitive',
            },
          },
        },
      ];
    }

    if (
      query.clientId
    ) {
      base.clientId =
        query.clientId;
    }

    if (
      query.projectId
    ) {
      base.projectId =
        query.projectId;
    }

    if (
      query.priority
    ) {
      base.priority =
        query.priority;
    }

    if (
      query.assigneeId
    ) {
      base.assignees = {
        some: {
          employeeId:
            query.assigneeId,
          removedAt:
            null,
        },
      };
    }

    const where =
      this.scopedWhere(
        base,
        scope,
      );

    const tasks =
      await this.prisma.task.findMany({
        where,
        select:
          this.taskSelect(),
        orderBy: [
          {
            dueAt:
              'asc',
          },
          {
            updatedAt:
              'desc',
          },
        ],
        take: 1000,
      });

    const cards =
      tasks
        .map(
          (task) =>
            this.serializeTask(
              task,
            ),
        )
        .filter(
          (task) =>
            task.column,
        );

    const columns = {
      TODO: cards.filter(
        (task) =>
          task.column ===
          'TODO',
      ),
      IN_PROGRESS:
        cards.filter(
          (task) =>
            task.column ===
            'IN_PROGRESS',
        ),
      REVIEW:
        cards.filter(
          (task) =>
            task.column ===
            'REVIEW',
        ),
      CHANGES_REQUESTED:
        cards.filter(
          (task) =>
            task.column ===
            'CHANGES_REQUESTED',
        ),
      DONE: cards.filter(
        (task) =>
          task.column ===
          'DONE',
      ),
    };

    return {
      columns,
      total:
        cards.length,
      permissions: {
        canUpdate:
          ctx.permissions.has(
            'tasks.update',
          ) ||
          ctx.roles.includes(
            'SUPER_ADMIN',
          ),
        canReview:
          ctx.permissions.has(
            'tasks.review',
          ) ||
          ctx.roles.includes(
            'SUPER_ADMIN',
          ),
        canApprove:
          ctx.permissions.has(
            'tasks.approve',
          ) ||
          ctx.roles.includes(
            'SUPER_ADMIN',
          ),
      },
    };
  }

  private async workflowStatus(
    code: string,
  ) {
    const status =
      await this.prisma.taskStatus.findFirst({
        where: {
          code,
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
          code: true,
          name: true,
          color: true,
        },
      });

    if (!status) {
      throw new BadRequestException(
        `Task status "${code}" not found.`,
      );
    }

    return status;
  }

  private async visibleWorkflowTask(
    taskId: string,
    userId: string,
    ctx: UserContext,
  ) {
    const scope =
      await this.taskScope(
        userId,
        ctx,
      );

    const where =
      this.scopedWhere(
        {
          id: taskId,
          deletedAt: null,
        },
        scope,
      );

    const task =
      await this.prisma.task.findFirst({
        where,
        select: {
          id: true,
          projectId: true,
          isDraft: true,
          createdById: true,
          statusId: true,

          status: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },

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
              isRequired: true,
            },
          },
        },
      });

    if (!task) {
      throw new NotFoundException(
        'Task not found.',
      );
    }

    return task;
  }

  private assertWorker(
    task: {
      createdById: string;
      assignees: Array<{
        employeeId: string;
      }>;
      collaborators: Array<{
        employeeId: string;
      }>;
    },
    userId: string,
    ctx: UserContext,
  ) {
    if (
      task.createdById ===
      userId
    ) {
      return;
    }

    if (
      !ctx.employeeId
    ) {
      throw new ForbiddenException(
        'Employee profile not found.',
      );
    }

    const canWork =
      task.assignees.some(
        (item) =>
          item.employeeId ===
          ctx.employeeId,
      ) ||
      task.collaborators.some(
        (item) =>
          item.employeeId ===
          ctx.employeeId,
      );

    if (!canWork) {
      throw new ForbiddenException(
        'You are not assigned to this task.',
      );
    }
  }

  private reviewerEmployee(
    task: {
      reviewers: Array<{
        employeeId: string;
        isRequired: boolean;
      }>;
    },
    ctx: UserContext,
  ) {
    if (
      !ctx.employeeId
    ) {
      throw new ForbiddenException(
        'Employee profile not found.',
      );
    }

    const reviewer =
      task.reviewers.find(
        (item) =>
          item.employeeId ===
          ctx.employeeId,
      );

    if (!reviewer) {
      throw new ForbiddenException(
        'You are not assigned as a reviewer for this task.',
      );
    }

    return ctx.employeeId;
  }

  private async ensureTransition(
    fromStatusId: string,
    toStatusId: string,
    ctx: UserContext,
  ) {
    const transition =
      await this.prisma.taskWorkflowTransition.findFirst({
        where: {
          fromStatusId,
          toStatusId,
          isActive: true,
        },
        select: {
          id: true,
          requiresApproval: true,
          requiredPermission: {
            select: {
              code: true,
            },
          },
        },
      });

    if (!transition) {
      throw new BadRequestException(
        'This workflow transition is not allowed.',
      );
    }

    if (
      transition.requiredPermission?.code
    ) {
      this.requirePermission(
        ctx,
        transition.requiredPermission.code,
      );
    }

    return transition;
  }

  private async simpleMove(
    task: Awaited<
      ReturnType<
        KanbanService['visibleWorkflowTask']
      >
    >,
    userId: string,
    ctx: UserContext,
    targetCode:
      | 'TODO'
      | 'IN_PROGRESS',
    note?: string,
  ) {
    this.assertWorker(
      task,
      userId,
      ctx,
    );

    const target =
      await this.workflowStatus(
        targetCode,
      );

    await this.ensureTransition(
      task.statusId,
      target.id,
      ctx,
    );

    const reason =
      this.clean(
        note,
      ) ??
      (
        targetCode ===
        'IN_PROGRESS'
          ? task.status.code ===
              'CHANGES_REQUESTED'
            ? 'Changes started'
            : 'Task moved to In Progress'
          : 'Task moved to To Do'
      );

    await this.prisma.$transaction(
      async (tx) => {
        await tx.task.update({
          where: {
            id:
              task.id,
          },
          data: {
            statusId:
              target.id,
          },
        });

        await tx.taskStatusHistory.create({
          data: {
            taskId:
              task.id,
            fromStatusId:
              task.statusId,
            toStatusId:
              target.id,
            changedById:
              userId,
            reason,
          },
        });
      },
    );

    await this.syncProjectStatusFromTasks(
      task.projectId,
    );

    return {
      taskId:
        task.id,
      status:
        target,
      completed: false,
      message:
        `Task moved to ${target.name}.`,
    };
  }

  private async submitForReview(
    task: Awaited<
      ReturnType<
        KanbanService['visibleWorkflowTask']
      >
    >,
    userId: string,
    ctx: UserContext,
    note?: string,
  ) {
    this.requirePermission(
      ctx,
      'tasks.update',
    );

    if (
      task.isDraft
    ) {
      throw new BadRequestException(
        'Draft task cannot be submitted for review.',
      );
    }

    this.assertWorker(
      task,
      userId,
      ctx,
    );

    if (
      !task.reviewers.length
    ) {
      throw new BadRequestException(
        'Assign at least one reviewer before submitting the task.',
      );
    }

    const reviewStatus =
      await this.workflowStatus(
        'REVIEW',
      );

    await this.ensureTransition(
      task.statusId,
      reviewStatus.id,
      ctx,
    );

    const now =
      new Date();

    await this.prisma.$transaction(
      async (tx) => {
        await tx.taskApproval.updateMany({
          where: {
            taskId:
              task.id,
            status:
              ApprovalStatus.PENDING,
          },
          data: {
            status:
              ApprovalStatus.CANCELLED,
            decidedById:
              userId,
            decidedAt:
              now,
            decisionNote:
              'Superseded by a new review request.',
          },
        });

        await tx.task.update({
          where: {
            id:
              task.id,
          },
          data: {
            statusId:
              reviewStatus.id,
          },
        });

        await tx.taskStatusHistory.create({
          data: {
            taskId:
              task.id,
            fromStatusId:
              task.statusId,
            toStatusId:
              reviewStatus.id,
            changedById:
              userId,
            reason:
              this.clean(
                note,
              ) ??
              'Submitted for review',
          },
        });

        await tx.taskApproval.createMany({
          data:
            task.reviewers.map(
              (reviewer) => ({
                taskId:
                  task.id,
                reviewerId:
                  reviewer.employeeId,
                requestedById:
                  userId,
                stageStatusId:
                  reviewStatus.id,
                status:
                  ApprovalStatus.PENDING,
              }),
            ),
        });
      },
    );

    await this.syncProjectStatusFromTasks(
      task.projectId,
    );

    await this.notifications.notifyTaskReviewers(
      task.id,
      userId,
      NotificationKind.TASK_SUBMITTED_FOR_REVIEW,
      'Task submitted for review',
      'A task is waiting for your review.',
    );

    return {
      taskId:
        task.id,
      status:
        reviewStatus,
      completed: false,
      message:
        'Task submitted for review.',
    };
  }

  private async requestChanges(
    task: Awaited<
      ReturnType<
        KanbanService['visibleWorkflowTask']
      >
    >,
    userId: string,
    ctx: UserContext,
    note?: string,
  ) {
    this.requirePermission(
      ctx,
      'tasks.review',
    );

    const reviewerId =
      this.reviewerEmployee(
        task,
        ctx,
      );

    const changesStatus =
      await this.workflowStatus(
        'CHANGES_REQUESTED',
      );

    await this.ensureTransition(
      task.statusId,
      changesStatus.id,
      ctx,
    );

    const approval =
      await this.prisma.taskApproval.findFirst({
        where: {
          taskId:
            task.id,
          reviewerId,
          status:
            ApprovalStatus.PENDING,
        },
        orderBy: {
          requestedAt:
            'desc',
        },
        select: {
          id: true,
        },
      });

    if (!approval) {
      throw new BadRequestException(
        'No pending review request was found for you.',
      );
    }

    const now =
      new Date();

    const reason =
      this.clean(
        note,
      ) ??
      'Changes requested';

    await this.prisma.$transaction(
      async (tx) => {
        await tx.taskApproval.update({
          where: {
            id:
              approval.id,
          },
          data: {
            status:
              ApprovalStatus.CHANGES_REQUESTED,
            decidedById:
              userId,
            decidedAt:
              now,
            decisionNote:
              reason,
          },
        });

        await tx.taskApproval.updateMany({
          where: {
            taskId:
              task.id,
            id: {
              not:
                approval.id,
            },
            status:
              ApprovalStatus.PENDING,
          },
          data: {
            status:
              ApprovalStatus.CANCELLED,
            decidedById:
              userId,
            decidedAt:
              now,
            decisionNote:
              'Review cycle closed because changes were requested.',
          },
        });

        await tx.task.update({
          where: {
            id:
              task.id,
          },
          data: {
            statusId:
              changesStatus.id,
          },
        });

        await tx.taskStatusHistory.create({
          data: {
            taskId:
              task.id,
            fromStatusId:
              task.statusId,
            toStatusId:
              changesStatus.id,
            changedById:
              userId,
            reason,
          },
        });
      },
    );

    await this.syncProjectStatusFromTasks(
      task.projectId,
    );

    await this.notifications.notifyTaskAssignees(
      task.id,
      userId,
      NotificationKind.TASK_CHANGES_REQUESTED,
      'Changes requested',
      reason,
    );

    return {
      taskId:
        task.id,
      status:
        changesStatus,
      completed: false,
      message:
        'Changes requested.',
    };
  }

  private async approve(
    task: Awaited<
      ReturnType<
        KanbanService['visibleWorkflowTask']
      >
    >,
    userId: string,
    ctx: UserContext,
    note?: string,
  ) {
    this.requirePermission(
      ctx,
      'tasks.approve',
    );

    const reviewerId =
      this.reviewerEmployee(
        task,
        ctx,
      );

    const doneStatus =
      await this.workflowStatus(
        'DONE',
      );

    await this.ensureTransition(
      task.statusId,
      doneStatus.id,
      ctx,
    );

    const approval =
      await this.prisma.taskApproval.findFirst({
        where: {
          taskId:
            task.id,
          reviewerId,
          status:
            ApprovalStatus.PENDING,
        },
        orderBy: {
          requestedAt:
            'desc',
        },
        select: {
          id: true,
          requestedAt: true,
        },
      });

    if (!approval) {
      throw new BadRequestException(
        'No pending approval was found for you.',
      );
    }

    const reviewStarted =
      await this.prisma.taskStatusHistory.findFirst({
        where: {
          taskId:
            task.id,
          toStatusId:
            task.statusId,
        },
        orderBy: {
          createdAt:
            'desc',
        },
        select: {
          createdAt: true,
        },
      });

    const now =
      new Date();

    let allApproved =
      false;

    await this.prisma.$transaction(
      async (tx) => {
        await tx.taskApproval.update({
          where: {
            id:
              approval.id,
          },
          data: {
            status:
              ApprovalStatus.APPROVED,
            decidedById:
              userId,
            decidedAt:
              now,
            decisionNote:
              this.clean(
                note,
              ) ??
              'Approved',
          },
        });

        const requiredReviewers =
          task.reviewers.filter(
            (reviewer) =>
              reviewer.isRequired,
          );

        const blockingReviewers =
          requiredReviewers.length
            ? requiredReviewers
            : task.reviewers;

        const approvals =
          await tx.taskApproval.findMany({
            where: {
              taskId:
                task.id,
              reviewerId: {
                in:
                  blockingReviewers.map(
                    (reviewer) =>
                      reviewer.employeeId,
                  ),
              },
              ...(reviewStarted
                ? {
                    requestedAt: {
                      gte:
                        reviewStarted.createdAt,
                    },
                  }
                : {}),
            },
            orderBy: {
              requestedAt:
                'desc',
            },
            select: {
              reviewerId: true,
              status: true,
            },
          });

        const latestByReviewer =
          new Map<
            string,
            ApprovalStatus
          >();

        for (const item of approvals) {
          if (
            item.reviewerId &&
            !latestByReviewer.has(
              item.reviewerId,
            )
          ) {
            latestByReviewer.set(
              item.reviewerId,
              item.status,
            );
          }
        }

        allApproved =
          blockingReviewers.every(
            (reviewer) =>
              latestByReviewer.get(
                reviewer.employeeId,
              ) ===
              ApprovalStatus.APPROVED,
          );

        if (allApproved) {
          await tx.task.update({
            where: {
              id:
                task.id,
            },
            data: {
              statusId:
                doneStatus.id,
            },
          });

          await tx.taskStatusHistory.create({
            data: {
              taskId:
                task.id,
              fromStatusId:
                task.statusId,
              toStatusId:
                doneStatus.id,
              changedById:
                userId,
              reason:
                this.clean(
                  note,
                ) ??
                'Task approved and completed',
            },
          });
        }
      },
    );

    await this.syncProjectStatusFromTasks(
      task.projectId,
    );

    await this.notifications.notifyTaskAssignees(
      task.id,
      userId,
      NotificationKind.TASK_APPROVED,
      'Task approved',
      'Your task has been approved.',
    );

    if (
      allApproved
    ) {
      await this.notifications.notifyTaskAssignees(
        task.id,
        userId,
        NotificationKind.TASK_COMPLETED,
        'Task completed',
        'Your task has been completed successfully.',
      );
    }

    return {
      taskId:
        task.id,
      status:
        allApproved
          ? doneStatus
          : task.status,
      completed:
        allApproved,
      message:
        allApproved
          ? 'Task approved and completed.'
          : 'Your approval is recorded. Waiting for remaining reviewers.',
    };
  }

  async move(
    userId: string,
    taskId: string,
    dto: MoveKanbanTaskDto,
  ) {
    const ctx =
      await this.context(
        userId,
      );

    this.requirePermission(
      ctx,
      'tasks.update',
    );

    const task =
      await this.visibleWorkflowTask(
        taskId,
        userId,
        ctx,
      );

    const currentColumn =
      this.columnCode(
        task.status.code,
      );

    if (
      currentColumn ===
      dto.targetCode
    ) {
      return {
        taskId:
          task.id,
        status:
          task.status,
        completed:
          currentColumn ===
          'DONE',
        message:
          'Task is already in this column.',
      };
    }

    if (
      dto.targetCode ===
      'REVIEW'
    ) {
      return this.submitForReview(
        task,
        userId,
        ctx,
        dto.note,
      );
    }

    if (
      dto.targetCode ===
      'CHANGES_REQUESTED'
    ) {
      return this.requestChanges(
        task,
        userId,
        ctx,
        dto.note,
      );
    }

    if (
      dto.targetCode ===
      'DONE'
    ) {
      return this.approve(
        task,
        userId,
        ctx,
        dto.note,
      );
    }

    return this.simpleMove(
      task,
      userId,
      ctx,
      dto.targetCode,
      dto.note,
    );
  }
}
