import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import {
  TimeEntryStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

type ReportQuery = {
  start?: string;
  end?: string;
  employeeId?: string;
  departmentId?: string;
  clientId?: string;
  projectId?: string;
  statusId?: string;
  priority?: string;
};

type UserContext = {
  roles: string[];
  permissions: Set<string>;
  employeeId: string | null;
};

@Injectable()
export class ReportsService {
  private readonly doneCodes = [
    'DONE',
    'COMPLETED',
  ];

  private readonly closedCodes = [
    'DONE',
    'COMPLETED',
    'CANCELLED',
    'ARCHIVED',
  ];

  private readonly reviewCodes = [
    'REVIEW',
    'INTERNAL_REVIEW',
    'CLIENT_REVIEW',
    'UNDER_REVIEW',
  ];

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private parseDate(
    value: string | undefined,
    fallback: Date,
  ) {
    if (!value) {
      return fallback;
    }

    const parsed =
      new Date(value);

    if (
      Number.isNaN(
        parsed.getTime(),
      )
    ) {
      throw new BadRequestException(
        'Invalid report date.',
      );
    }

    return parsed;
  }

  private defaultRange() {
    const now =
      new Date();

    const start =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      );

    const end =
      new Date(
        now.getFullYear(),
        now.getMonth() +
          1,
        1,
      );

    return {
      start,
      end,
    };
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
      roles:
        userRoles.map(
          (item) =>
            item.role.name,
        ),
      permissions,
      employeeId:
        employee?.id ??
        null,
    };
  }

  private async taskScope(
    userId: string,
    ctx?: UserContext,
  ): Promise<any> {
    const context =
      ctx ??
      await this.context(
        userId,
      );

    if (
      context.roles.includes(
        'SUPER_ADMIN',
      ) ||
      context.roles.includes(
        'ADMIN',
      )
    ) {
      return {};
    }

    if (!context.employeeId) {
      return {
        id:
          '__NO_REPORT_TASK_ACCESS__',
      };
    }

    if (
      context.roles.includes(
        'MANAGER',
      )
    ) {
      const directReports =
        await this.prisma.employeeProfile.findMany({
          where: {
            reportingManagerId:
              context.employeeId,
            deletedAt: null,
          },
          select: {
            id: true,
          },
        });

      const teamIds = [
        context.employeeId,
        ...directReports.map(
          (item) =>
            item.id,
        ),
      ];

      const managedProjects =
        await this.prisma.project.findMany({
          where: {
            projectManagerId:
              context.employeeId,
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
                    teamIds,
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
                    teamIds,
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
                  context.employeeId,
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
                context.employeeId,
              removedAt:
                null,
            },
          },
        },
        {
          collaborators: {
            some: {
              employeeId:
                context.employeeId,
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

  private effectiveSeconds(
    entry: {
      status:
        TimeEntryStatus;
      durationSeconds:
        number;
      activeStartedAt:
        Date | null;
    },
  ) {
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
              Date.now() -
              entry.activeStartedAt.getTime()
            ) /
              1000,
          ),
        );
    }

    return seconds;
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

    const scopedTaskWhere =
      this.scopedWhere(
        {
          deletedAt:
            null,
          isDraft:
            false,
        },
        scope,
      );

    const [
      tasks,
      statuses,
      departments,
    ] =
      await Promise.all([
        this.prisma.task.findMany({
          where:
            scopedTaskWhere,
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
                departmentId:
                  true,
              },
            },
            department: {
              select: {
                id: true,
                name: true,
              },
            },
            assignees: {
              where: {
                removedAt:
                  null,
              },
              select: {
                employee: {
                  select: {
                    id: true,
                    fullName: true,
                    username: true,
                    departmentId:
                      true,
                  },
                },
              },
            },
          },
          take: 5000,
        }),
        this.prisma.taskStatus.findMany({
          where: {
            deletedAt:
              null,
            isActive:
              true,
          },
          select: {
            id: true,
            code: true,
            name: true,
          },
          orderBy: [
            {
              sortOrder:
                'asc',
            },
            {
              name:
                'asc',
            },
          ],
        }),
        this.prisma.department.findMany({
          where: {
            deletedAt:
              null,
            isActive:
              true,
          },
          select: {
            id: true,
            name: true,
          },
          orderBy: {
            name:
              'asc',
          },
        }),
      ]);

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
          departmentId:
            | string
            | null;
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
          departmentId:
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
      departments,
      statuses,
      priorities: [
        'LOW',
        'MEDIUM',
        'HIGH',
        'URGENT',
      ],
      canExport:
        ctx.roles.includes(
          'SUPER_ADMIN',
        ) ||
        ctx.permissions.has(
          'reports.export',
        ),
    };
  }

  async data(
    userId: string,
    query: ReportQuery,
  ) {
    const defaults =
      this.defaultRange();

    const start =
      this.parseDate(
        query.start,
        defaults.start,
      );

    const end =
      this.parseDate(
        query.end,
        defaults.end,
      );

    if (
      end <= start
    ) {
      throw new BadRequestException(
        'Report end date must be after start date.',
      );
    }

    const now =
      new Date();

    const todayStart =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );

    const todayEnd =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() +
          1,
      );

    const weekEnd =
      new Date(
        todayStart,
      );

    weekEnd.setDate(
      weekEnd.getDate() +
        7,
    );

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
      deletedAt:
        null,
      isDraft:
        false,
    };

    if (
      query.employeeId
    ) {
      base.assignees = {
        some: {
          employeeId:
            query.employeeId,
          removedAt:
            null,
        },
      };
    }

    if (
      query.departmentId
    ) {
      base.departmentId =
        query.departmentId;
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
      query.statusId
    ) {
      base.statusId =
        query.statusId;
    }

    if (
      query.priority
    ) {
      base.priority =
        query.priority;
    }

    const rangeCondition = {
      OR: [
        {
          createdAt: {
            gte:
              start,
            lt:
              end,
          },
        },
        {
          dueAt: {
            gte:
              start,
            lt:
              end,
          },
        },
        {
          statusHistory: {
            some: {
              toStatus: {
                code: {
                  in:
                    this.doneCodes,
                },
              },
              createdAt: {
                gte:
                  start,
                lt:
                  end,
              },
            },
          },
        },
      ],
    };

    const taskWhere =
      this.scopedWhere(
        {
          AND: [
            base,
            rangeCondition,
          ],
        },
        scope,
      );

    const taskSelect: any = {
      id: true,
      title: true,
      priority: true,
      dueAt: true,
      startDate: true,
      estimatedHours: true,
      createdAt: true,
      updatedAt: true,
      isCritical: true,

      status: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },

      client: {
        select: {
          id: true,
          name: true,
          companyName:
            true,
        },
      },

      project: {
        select: {
          id: true,
          name: true,
          status: true,
          estimatedHours:
            true,
          deadline: true,
          departmentId:
            true,
        },
      },

      department: {
        select: {
          id: true,
          name: true,
        },
      },

      assignees: {
        where: {
          removedAt:
            null,
        },
        select: {
          isPrimary:
            true,
          employee: {
            select: {
              id: true,
              employeeId:
                true,
              username:
                true,
              fullName:
                true,
              designation:
                true,
              departmentId:
                true,
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

      statusHistory: {
        where: {
          toStatus: {
            code: {
              in:
                this.doneCodes,
            },
          },
        },
        orderBy: {
          createdAt:
            'desc',
        },
        take: 1,
        select: {
          createdAt:
            true,
          toStatus: {
            select: {
              code: true,
            },
          },
        },
      },
    };

    const tasks =
      await this.prisma.task.findMany({
        where:
          taskWhere,
        select:
          taskSelect,
        orderBy: {
          dueAt:
            'asc',
        },
        take: 10000,
      });

    const taskIds =
      tasks.map(
        (task: any) =>
          task.id,
      );

    const projectIds =
      [
        ...new Set(
          tasks.map(
            (task: any) =>
              task.project.id,
          ),
        ),
      ];

    const clientIds =
      [
        ...new Set(
          tasks.map(
            (task: any) =>
              task.client.id,
          ),
        ),
      ];

    const employeeIds =
      [
        ...new Set(
          tasks.flatMap(
            (task: any) =>
              task.assignees.map(
                (
                  assignment: any,
                ) =>
                  assignment.employee.id,
              ),
          ),
        ),
      ];

    const timeWhere: any = {
      deletedAt:
        null,
      workDate: {
        gte:
          start,
        lt:
          end,
      },
      ...(taskIds.length
        ? {
            taskId: {
              in:
                taskIds,
            },
          }
        : {
            taskId:
              '__NO_TASK__',
          }),
    };

    if (
      query.employeeId
    ) {
      timeWhere.employeeId =
        query.employeeId;
    }

    if (
      query.projectId
    ) {
      timeWhere.projectId =
        query.projectId;
    }

    const [
      timeEntries,
      projects,
      clients,
      rescheduleLogs,
    ] =
      await Promise.all([
        this.prisma.timeEntry.findMany({
          where:
            timeWhere,
          select: {
            employeeId:
              true,
            projectId:
              true,
            taskId:
              true,
            status:
              true,
            durationSeconds:
              true,
            activeStartedAt:
              true,
          },
          take: 50000,
        }),
        this.prisma.project.findMany({
          where: {
            deletedAt:
              null,
            id: {
              in:
                projectIds.length
                  ? projectIds
                  : [
                      '__NO_PROJECT__',
                    ],
            },
            ...(query.departmentId
              ? {
                  departmentId:
                    query.departmentId,
                }
              : {}),
            ...(query.clientId
              ? {
                  clientId:
                    query.clientId,
                }
              : {}),
            ...(query.projectId
              ? {
                  id:
                    query.projectId,
                }
              : {}),
          },
          select: {
            id: true,
            name: true,
            status: true,
            priority: true,
            estimatedHours:
              true,
            deadline: true,
            clientId: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
            projectManager: {
              select: {
                id: true,
                fullName:
                  true,
              },
            },
            members: {
              where: {
                isActive:
                  true,
                leftAt:
                  null,
              },
              select: {
                employeeId:
                  true,
              },
            },
            milestones: {
              where: {
                deletedAt:
                  null,
              },
              select: {
                id: true,
                status: true,
                dueDate:
                  true,
                completedAt:
                  true,
              },
            },
          },
        }),
        this.prisma.client.findMany({
          where: {
            deletedAt:
              null,
            id: {
              in:
                clientIds.length
                  ? clientIds
                  : [
                      '__NO_CLIENT__',
                    ],
            },
            ...(query.clientId
              ? {
                  id:
                    query.clientId,
                }
              : {}),
          },
          select: {
            id: true,
            name: true,
            companyName:
              true,
            status: true,
          },
        }),
        this.prisma.activityLog.findMany({
          where: {
            entityType:
              'TASK',
            entityId: {
              in:
                taskIds.length
                  ? taskIds
                  : [
                      '__NO_TASK__',
                    ],
            },
            action: {
              in: [
                'TASK_DEADLINE_CHANGED',
                'DEADLINE_CHANGED',
                'TASK_RESCHEDULED',
              ],
            },
            createdAt: {
              gte:
                start,
              lt:
                end,
            },
          },
          select: {
            entityId:
              true,
          },
          take: 10000,
        }),
      ]);

    const completionAt =
      new Map<
        string,
        Date
      >();

    for (const task of tasks as any[]) {
      const completed =
        task.statusHistory?.[0]
          ?.createdAt;

      if (completed) {
        completionAt.set(
          task.id,
          new Date(
            completed,
          ),
        );
      }
    }

    const timeByEmployee =
      new Map<
        string,
        number
      >();

    const timeByProject =
      new Map<
        string,
        number
      >();

    const timeByTask =
      new Map<
        string,
        number
      >();

    for (const entry of timeEntries) {
      const seconds =
        this.effectiveSeconds(
          entry,
        );

      timeByEmployee.set(
        entry.employeeId,
        (
          timeByEmployee.get(
            entry.employeeId,
          ) ??
          0
        ) +
          seconds,
      );

      timeByProject.set(
        entry.projectId,
        (
          timeByProject.get(
            entry.projectId,
          ) ??
          0
        ) +
          seconds,
      );

      if (
        entry.taskId
      ) {
        timeByTask.set(
          entry.taskId,
          (
            timeByTask.get(
              entry.taskId,
            ) ??
            0
          ) +
            seconds,
        );
      }
    }

    const isDone =
      (task: any) =>
        this.doneCodes.includes(
          task.status.code,
        );

    const isClosed =
      (task: any) =>
        this.closedCodes.includes(
          task.status.code,
        );

    const overdue =
      (task: any) =>
        Boolean(
          task.dueAt &&
          new Date(
            task.dueAt,
          ) <
            now &&
          !isClosed(
            task,
          ),
        );

    const totalTasks =
      tasks.length;

    const completedTasks =
      tasks.filter(
        isDone,
      ).length;

    const dueToday =
      tasks.filter(
        (task: any) =>
          task.dueAt &&
          new Date(
            task.dueAt,
          ) >=
            todayStart &&
          new Date(
            task.dueAt,
          ) <
            todayEnd &&
          !isClosed(
            task,
          ),
      ).length;

    const overview = {
      totalTasks,
      dueToday,
      overdue:
        tasks.filter(
          overdue,
        ).length,
      completed:
        completedTasks,
      inProgress:
        tasks.filter(
          (task: any) =>
            [
              'IN_PROGRESS',
              'ACTIVE',
            ].includes(
              task.status.code,
            ),
        ).length,
      waitingReview:
        tasks.filter(
          (task: any) =>
            this.reviewCodes.includes(
              task.status.code,
            ),
        ).length,
      completionRate:
        totalTasks
          ? Math.round(
              (
                completedTasks /
                totalTasks
              ) *
                100,
            )
          : 0,
      loggedHours:
        Number(
          (
            [...timeByTask.values()].reduce(
              (
                total,
                seconds,
              ) =>
                total +
                seconds,
              0,
            ) /
            3600
          ).toFixed(
            2,
          ),
        ),
    };

    const employeeMap =
      new Map<
        string,
        any
      >();

    for (const task of tasks as any[]) {
      for (
        const assignment
        of task.assignees
      ) {
        const employee =
          assignment.employee;

        if (
          query.employeeId &&
          employee.id !==
            query.employeeId
        ) {
          continue;
        }

        if (
          query.departmentId &&
          employee.departmentId !==
            query.departmentId
        ) {
          continue;
        }

        const item =
          employeeMap.get(
            employee.id,
          ) ?? {
            employeeId:
              employee.id,
            employeeCode:
              employee.employeeId,
            fullName:
              employee.fullName,
            username:
              employee.username,
            designation:
              employee.designation,
            department:
              employee.department?.name ??
              '—',
            tasksAssigned:
              0,
            tasksCompleted:
              0,
            onTimeTasks:
              0,
            overdueTasks:
              0,
            activeWorkload:
              0,
            completionHours:
              [] as number[],
          };

        item.tasksAssigned +=
          1;

        if (
          isDone(
            task,
          )
        ) {
          item.tasksCompleted +=
            1;

          const completedAt =
            completionAt.get(
              task.id,
            );

          if (
            completedAt
          ) {
            item.completionHours.push(
              Math.max(
                0,
                (
                  completedAt.getTime() -
                  new Date(
                    task.createdAt,
                  ).getTime()
                ) /
                  3600000,
              ),
            );

            if (
              !task.dueAt ||
              completedAt <=
                new Date(
                  task.dueAt,
                )
            ) {
              item.onTimeTasks +=
                1;
            }
          }
        } else {
          item.activeWorkload +=
            1;
        }

        if (
          overdue(
            task,
          )
        ) {
          item.overdueTasks +=
            1;
        }

        employeeMap.set(
          employee.id,
          item,
        );
      }
    }

    const employeePerformance =
      [...employeeMap.values()]
        .map(
          (item) => ({
            ...item,
            averageCompletionHours:
              item.completionHours.length
                ? Number(
                    (
                      item.completionHours.reduce(
                        (
                          total: number,
                          value: number,
                        ) =>
                          total +
                          value,
                        0,
                      ) /
                      item.completionHours.length
                    ).toFixed(
                      2,
                    ),
                  )
                : 0,
            loggedHours:
              Number(
                (
                  (
                    timeByEmployee.get(
                      item.employeeId,
                    ) ??
                    0
                  ) /
                  3600
                ).toFixed(
                  2,
                ),
              ),
            completionRate:
              item.tasksAssigned
                ? Math.round(
                    (
                      item.tasksCompleted /
                      item.tasksAssigned
                    ) *
                      100,
                  )
                : 0,
          }),
        )
        .map(
          ({
            completionHours,
            ...item
          }) =>
            item,
        )
        .sort(
          (
            a,
            b,
          ) =>
            b.tasksCompleted -
            a.tasksCompleted,
        );

    const projectReport =
      projects
        .map(
          (project: any) => {
            const projectTasks =
              (tasks as any[]).filter(
                (task) =>
                  task.project.id ===
                  project.id,
              );

            const completed =
              projectTasks.filter(
                isDone,
              ).length;

            const overdueCount =
              projectTasks.filter(
                overdue,
              ).length;

            const completedMilestones =
              project.milestones.filter(
                (milestone: any) =>
                  milestone.status ===
                    'COMPLETED' ||
                  Boolean(
                    milestone.completedAt,
                  ),
              ).length;

            const milestoneTotal =
              project.milestones.length;

            const loggedHours =
              (
                timeByProject.get(
                  project.id,
                ) ??
                0
              ) /
              3600;

            return {
              projectId:
                project.id,
              projectName:
                project.name,
              client:
                project.client.name,
              manager:
                project.projectManager?.fullName ??
                '—',
              status:
                project.status,
              priority:
                project.priority,
              deadline:
                project.deadline,
              totalTasks:
                projectTasks.length,
              completedTasks:
                completed,
              pendingTasks:
                projectTasks.length -
                completed,
              overdueTasks:
                overdueCount,
              progress:
                projectTasks.length
                  ? Math.round(
                      (
                        completed /
                        projectTasks.length
                      ) *
                        100,
                    )
                  : 0,
              milestoneProgress:
                milestoneTotal
                  ? Math.round(
                      (
                        completedMilestones /
                        milestoneTotal
                      ) *
                        100,
                    )
                  : 0,
              milestonesCompleted:
                completedMilestones,
              milestonesTotal:
                milestoneTotal,
              estimatedHours:
                project.estimatedHours
                  ? Number(
                      project.estimatedHours,
                    )
                  : 0,
              loggedHours:
                Number(
                  loggedHours.toFixed(
                    2,
                  ),
                ),
              teamMembers:
                project.members.length,
            };
          },
        )
        .sort(
          (
            a,
            b,
          ) =>
            b.overdueTasks -
            a.overdueTasks,
        );

    const taskRows =
      (tasks as any[]).map(
        (task) => {
          const completedAt =
            completionAt.get(
              task.id,
            );

          return {
            taskId:
              task.id,
            title:
              task.title,
            client:
              task.client.name,
            project:
              task.project.name,
            department:
              task.department?.name ??
              '—',
            assignees:
              task.assignees
                .map(
                  (
                    assignment: any,
                  ) =>
                    assignment.employee.fullName,
                )
                .join(
                  ', ',
                ) ||
              'Unassigned',
            status:
              task.status.name,
            statusCode:
              task.status.code,
            priority:
              task.priority,
            dueAt:
              task.dueAt,
            completedAt:
              completedAt?.toISOString() ??
              null,
            isOverdue:
              overdue(
                task,
              ),
            estimatedHours:
              task.estimatedHours
                ? Number(
                    task.estimatedHours,
                  )
                : 0,
            loggedHours:
              Number(
                (
                  (
                    timeByTask.get(
                      task.id,
                    ) ??
                    0
                  ) /
                  3600
                ).toFixed(
                  2,
                ),
              ),
          };
        },
      );

    const upcomingDeadlines =
      taskRows
        .filter(
          (task) =>
            task.dueAt &&
            new Date(
              task.dueAt,
            ) >=
              now &&
            !this.closedCodes.includes(
              task.statusCode,
            ),
        )
        .sort(
          (
            a,
            b,
          ) =>
            new Date(
              a.dueAt!,
            ).getTime() -
            new Date(
              b.dueAt!,
            ).getTime(),
        );

    const overdueRows =
      taskRows.filter(
        (task) =>
          task.isOverdue,
      );

    const dueTodayRows =
      taskRows.filter(
        (task) =>
          task.dueAt &&
          new Date(
            task.dueAt,
          ) >=
            todayStart &&
          new Date(
            task.dueAt,
          ) <
            todayEnd &&
          !this.closedCodes.includes(
            task.statusCode,
          ),
      );

    const dueThisWeekRows =
      taskRows.filter(
        (task) =>
          task.dueAt &&
          new Date(
            task.dueAt,
          ) >=
            todayStart &&
          new Date(
            task.dueAt,
          ) <
            weekEnd &&
          !this.closedCodes.includes(
            task.statusCode,
          ),
      );

    const rescheduledIds =
      new Set(
        rescheduleLogs
          .map(
            (item) =>
              item.entityId,
          )
          .filter(
            Boolean,
          ),
      );

    const dueDateReport = {
      upcomingDeadlines,
      overdueTasks:
        overdueRows,
      dueToday:
        dueTodayRows,
      dueThisWeek:
        dueThisWeekRows,
      rescheduledTasks:
        taskRows.filter(
          (task) =>
            rescheduledIds.has(
              task.taskId,
            ),
        ),
    };

    const clientReport =
      clients
        .map(
          (client: any) => {
            const clientProjects =
              projects.filter(
                (project: any) =>
                  project.clientId ===
                  client.id,
              );

            const clientTasks =
              (tasks as any[]).filter(
                (task) =>
                  task.client.id ===
                  client.id,
              );

            const members =
              new Set<string>();

            for (const task of clientTasks) {
              for (
                const assignment
                of task.assignees
              ) {
                members.add(
                  assignment.employee.id,
                );
              }
            }

            return {
              clientId:
                client.id,
              clientName:
                client.name,
              companyName:
                client.companyName ??
                '—',
              status:
                client.status,
              activeProjects:
                clientProjects.filter(
                  (project: any) =>
                    project.status ===
                    'ACTIVE',
                ).length,
              completedProjects:
                clientProjects.filter(
                  (project: any) =>
                    project.status ===
                    'COMPLETED',
                ).length,
              pendingTasks:
                clientTasks.filter(
                  (
                    task,
                  ) =>
                    !isClosed(
                      task,
                    ),
                ).length,
              overdueTasks:
                clientTasks.filter(
                  overdue,
                ).length,
              assignedTeamMembers:
                members.size,
              totalProjects:
                clientProjects.length,
              totalTasks:
                clientTasks.length,
            };
          },
        )
        .sort(
          (
            a,
            b,
          ) =>
            b.overdueTasks -
            a.overdueTasks,
        );

    return {
      range: {
        start:
          start.toISOString(),
        end:
          end.toISOString(),
        semantics:
          'Date range includes tasks created, due, or completed during the selected period. Time logs use work date.',
      },
      generatedAt:
        new Date().toISOString(),
      overview,
      employeePerformance,
      projectReport,
      dueDateReport,
      clientReport,
      taskRows,
      filters: {
        employeeId:
          query.employeeId ??
          null,
        departmentId:
          query.departmentId ??
          null,
        clientId:
          query.clientId ??
          null,
        projectId:
          query.projectId ??
          null,
        statusId:
          query.statusId ??
          null,
        priority:
          query.priority ??
          null,
      },
      permissions: {
        canExport:
          ctx.roles.includes(
            'SUPER_ADMIN',
          ) ||
          ctx.permissions.has(
            'reports.export',
          ),
      },
    };
  }
}
