import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private readonly completedCodes = [
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

  private todayRange() {
    const now = new Date();

    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const end = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );

    return {
      now,
      start,
      end,
    };
  }

  private async getEmployeeByUserId(
    userId: string,
  ) {
    const employee =
      await this.prisma.employeeProfile.findFirst({
        where: {
          userId,
          deletedAt: null,
          user: {
            isActive: true,
            deletedAt: null,
          },
        },

        include: {
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
              profileImageUrl: true,
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
              profileImageUrl: true,
              employmentStatus: true,
            },
          },
        },
      });

    if (!employee) {
      throw new NotFoundException(
        'Employee profile not found for logged-in user.',
      );
    }

    return employee;
  }

  async adminDashboard() {
    const {
      now,
      start,
      end,
    } = this.todayRange();

    const [
      totalDepartments,
      activeDepartments,
      totalEmployees,
      activeEmployees,
      totalClients,
      activeClients,
      totalProjects,
      activeProjects,
      totalTasks,
      dueToday,
      overdue,
      inProgress,
      waitingReview,
      completed,
      criticalTasks,
      recentTasks,
      recentProjects,
      departments,
    ] = await Promise.all([
      this.prisma.department.count({
        where: {
          deletedAt: null,
        },
      }),

      this.prisma.department.count({
        where: {
          deletedAt: null,
          isActive: true,
        },
      }),

      this.prisma.employeeProfile.count({
        where: {
          deletedAt: null,
        },
      }),

      this.prisma.employeeProfile.count({
        where: {
          deletedAt: null,
          employmentStatus: 'ACTIVE',
          user: {
            isActive: true,
            deletedAt: null,
          },
        },
      }),

      this.prisma.client.count({
        where: {
          deletedAt: null,
        },
      }),

      this.prisma.client.count({
        where: {
          deletedAt: null,
          isActive: true,
        },
      }),

      this.prisma.project.count({
        where: {
          deletedAt: null,
        },
      }),

      this.prisma.project.count({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
        },
      }),

      this.prisma.task.count({
        where: {
          deletedAt: null,
        },
      }),

      this.prisma.task.count({
        where: {
          deletedAt: null,

          dueAt: {
            gte: start,
            lt: end,
          },

          status: {
            code: {
              notIn:
                this.completedCodes,
            },
          },
        },
      }),

      this.prisma.task.count({
        where: {
          deletedAt: null,

          dueAt: {
            lt: now,
          },

          status: {
            code: {
              notIn:
                this.completedCodes,
            },
          },
        },
      }),

      this.prisma.task.count({
        where: {
          deletedAt: null,

          status: {
            code: {
              in: [
                'IN_PROGRESS',
                'ACTIVE',
              ],
            },
          },
        },
      }),

      this.prisma.task.count({
        where: {
          deletedAt: null,

          status: {
            code: {
              in:
                this.reviewCodes,
            },
          },
        },
      }),

      this.prisma.task.count({
        where: {
          deletedAt: null,

          status: {
            code: {
              in: [
                'DONE',
                'COMPLETED',
              ],
            },
          },
        },
      }),

      this.prisma.task.count({
        where: {
          deletedAt: null,
          isCritical: true,

          status: {
            code: {
              notIn:
                this.completedCodes,
            },
          },
        },
      }),

      this.prisma.task.findMany({
        where: {
          deletedAt: null,
        },

        take: 8,

        orderBy: {
          updatedAt: 'desc',
        },

        select: {
          id: true,
          title: true,
          priority: true,
          dueAt: true,
          isCritical: true,
          isDraft: true,
          updatedAt: true,

          status: {
            select: {
              id: true,
              code: true,
              name: true,
              color: true,
            },
          },

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
            },
          },

          assignees: {
            where: {
              removedAt: null,
            },

            orderBy: {
              isPrimary: 'desc',
            },

            take: 3,

            select: {
              id: true,
              isPrimary: true,

              employee: {
                select: {
                  id: true,
                  username: true,
                  fullName: true,
                  profileImageUrl: true,
                },
              },
            },
          },
        },
      }),

      this.prisma.project.findMany({
        where: {
          deletedAt: null,
        },

        take: 6,

        orderBy: {
          updatedAt: 'desc',
        },

        select: {
          id: true,
          name: true,
          status: true,
          priority: true,
          deadline: true,

          client: {
            select: {
              id: true,
              name: true,
            },
          },

          projectManager: {
            select: {
              id: true,
              fullName: true,
            },
          },

          _count: {
            select: {
              tasks: true,
              members: true,
            },
          },
        },
      }),

      this.prisma.department.findMany({
        where: {
          deletedAt: null,
          isActive: true,
        },

        orderBy: {
          name: 'asc',
        },

        select: {
          id: true,
          name: true,

          _count: {
            select: {
              members: true,
              projects: true,
              tasks: true,
            },
          },
        },
      }),
    ]);

    return {
      role: 'ADMIN',

      stats: {
        totalDepartments,
        activeDepartments,
        totalEmployees,
        activeEmployees,
        totalClients,
        activeClients,
        totalProjects,
        activeProjects,
        totalTasks,
        dueToday,
        overdue,
        inProgress,
        waitingReview,
        completed,
        criticalTasks,
      },

      recentTasks,
      recentProjects,
      departments,
    };
  }

  async managerDashboard(
    userId: string,
  ) {
    const employee =
      await this.getEmployeeByUserId(
        userId,
      );

    const {
      now,
      start,
      end,
    } = this.todayRange();

    const teamEmployeeIds =
      employee.directReports.map(
        (item) => item.id,
      );

    const scopedEmployeeIds = [
      employee.id,
      ...teamEmployeeIds,
    ];

    const managerScope = {
      OR: [
        {
          assignees: {
            some: {
              employeeId: {
                in: scopedEmployeeIds,
              },
              removedAt: null,
            },
          },
        },

        {
          reviewers: {
            some: {
              employeeId:
                employee.id,
            },
          },
        },

        {
          project: {
            projectManagerId:
              employee.id,
          },
        },
      ],
    };

    const taskWhere = (
      extra: Record<
        string,
        unknown
      > = {},
    ) => ({
      deletedAt: null,

      AND: [
        managerScope,
        extra,
      ],
    });

    const [
      totalTasks,
      dueToday,
      overdue,
      inProgress,
      waitingReview,
      completed,
      criticalTasks,
      managedProjects,
      recentTasks,
    ] = await Promise.all([
      this.prisma.task.count({
        where: taskWhere(),
      }),

      this.prisma.task.count({
        where: taskWhere({
          dueAt: {
            gte: start,
            lt: end,
          },

          status: {
            code: {
              notIn:
                this.completedCodes,
            },
          },
        }),
      }),

      this.prisma.task.count({
        where: taskWhere({
          dueAt: {
            lt: now,
          },

          status: {
            code: {
              notIn:
                this.completedCodes,
            },
          },
        }),
      }),

      this.prisma.task.count({
        where: taskWhere({
          status: {
            code: {
              in: [
                'IN_PROGRESS',
                'ACTIVE',
              ],
            },
          },
        }),
      }),

      this.prisma.task.count({
        where: taskWhere({
          status: {
            code: {
              in:
                this.reviewCodes,
            },
          },
        }),
      }),

      this.prisma.task.count({
        where: taskWhere({
          status: {
            code: {
              in: [
                'DONE',
                'COMPLETED',
              ],
            },
          },
        }),
      }),

      this.prisma.task.count({
        where: taskWhere({
          isCritical: true,

          status: {
            code: {
              notIn:
                this.completedCodes,
            },
          },
        }),
      }),

      this.prisma.project.findMany({
        where: {
          deletedAt: null,

          OR: [
            {
              projectManagerId:
                employee.id,
            },

            {
              members: {
                some: {
                  employeeId:
                    employee.id,
                  isActive: true,
                },
              },
            },
          ],
        },

        take: 8,

        orderBy: {
          updatedAt: 'desc',
        },

        select: {
          id: true,
          name: true,
          status: true,
          priority: true,
          deadline: true,

          client: {
            select: {
              id: true,
              name: true,
            },
          },

          _count: {
            select: {
              members: true,
              tasks: true,
            },
          },
        },
      }),

      this.prisma.task.findMany({
        where: taskWhere(),

        take: 8,

        orderBy: {
          updatedAt: 'desc',
        },

        select: {
          id: true,
          title: true,
          priority: true,
          dueAt: true,
          isCritical: true,
          updatedAt: true,

          status: {
            select: {
              id: true,
              code: true,
              name: true,
              color: true,
            },
          },

          project: {
            select: {
              id: true,
              name: true,
            },
          },

          client: {
            select: {
              id: true,
              name: true,
            },
          },

          assignees: {
            where: {
              removedAt: null,
            },

            orderBy: {
              isPrimary: 'desc',
            },

            select: {
              id: true,
              isPrimary: true,

              employee: {
                select: {
                  id: true,
                  username: true,
                  fullName: true,
                  profileImageUrl: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const teamWorkload =
      await Promise.all(
        employee.directReports.map(
          async (member) => {
            const [
              activeTasks,
              overdueTasks,
            ] = await Promise.all([
              this.prisma.task.count({
                where: {
                  deletedAt: null,

                  assignees: {
                    some: {
                      employeeId:
                        member.id,
                      removedAt: null,
                    },
                  },

                  status: {
                    code: {
                      notIn:
                        this.completedCodes,
                    },
                  },
                },
              }),

              this.prisma.task.count({
                where: {
                  deletedAt: null,

                  dueAt: {
                    lt: now,
                  },

                  assignees: {
                    some: {
                      employeeId:
                        member.id,
                      removedAt: null,
                    },
                  },

                  status: {
                    code: {
                      notIn:
                        this.completedCodes,
                    },
                  },
                },
              }),
            ]);

            return {
              ...member,
              activeTasks,
              overdueTasks,
            };
          },
        ),
      );

    return {
      role: 'MANAGER',

      profile: {
        id: employee.id,
        employeeId:
          employee.employeeId,
        username:
          employee.username,
        fullName:
          employee.fullName,
        designation:
          employee.designation,
        profileImageUrl:
          employee.profileImageUrl,
        department:
          employee.department,
      },

      stats: {
        totalTasks,
        dueToday,
        overdue,
        inProgress,
        waitingReview,
        completed,
        criticalTasks,
        teamMembers:
          employee.directReports.length,
        managedProjects:
          managedProjects.length,
      },

      teamWorkload,
      managedProjects,
      recentTasks,
    };
  }

  async employeeDashboard(
    userId: string,
  ) {
    const employee =
      await this.getEmployeeByUserId(
        userId,
      );

    const {
      now,
      start,
      end,
    } = this.todayRange();

    const ownScope = {
      assignees: {
        some: {
          employeeId:
            employee.id,
          removedAt: null,
        },
      },
    };

    const ownTaskWhere = (
      extra: Record<
        string,
        unknown
      > = {},
    ) => ({
      deletedAt: null,

      AND: [
        ownScope,
        extra,
      ],
    });

    const [
      totalTasks,
      dueToday,
      overdue,
      inProgress,
      waitingReview,
      completed,
      criticalTasks,
      recentTasks,
      projects,
    ] = await Promise.all([
      this.prisma.task.count({
        where: ownTaskWhere(),
      }),

      this.prisma.task.count({
        where: ownTaskWhere({
          dueAt: {
            gte: start,
            lt: end,
          },

          status: {
            code: {
              notIn:
                this.completedCodes,
            },
          },
        }),
      }),

      this.prisma.task.count({
        where: ownTaskWhere({
          dueAt: {
            lt: now,
          },

          status: {
            code: {
              notIn:
                this.completedCodes,
            },
          },
        }),
      }),

      this.prisma.task.count({
        where: ownTaskWhere({
          status: {
            code: {
              in: [
                'IN_PROGRESS',
                'ACTIVE',
              ],
            },
          },
        }),
      }),

      this.prisma.task.count({
        where: ownTaskWhere({
          status: {
            code: {
              in:
                this.reviewCodes,
            },
          },
        }),
      }),

      this.prisma.task.count({
        where: ownTaskWhere({
          status: {
            code: {
              in: [
                'DONE',
                'COMPLETED',
              ],
            },
          },
        }),
      }),

      this.prisma.task.count({
        where: ownTaskWhere({
          isCritical: true,

          status: {
            code: {
              notIn:
                this.completedCodes,
            },
          },
        }),
      }),

      this.prisma.task.findMany({
        where: ownTaskWhere(),

        take: 10,

        orderBy: {
          updatedAt: 'desc',
        },

        select: {
          id: true,
          title: true,
          priority: true,
          dueAt: true,
          startDate: true,
          estimatedHours: true,
          isCritical: true,
          updatedAt: true,

          status: {
            select: {
              id: true,
              code: true,
              name: true,
              color: true,
            },
          },

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
            },
          },
        },
      }),

      this.prisma.project.findMany({
        where: {
          deletedAt: null,

          OR: [
            {
              projectManagerId:
                employee.id,
            },

            {
              members: {
                some: {
                  employeeId:
                    employee.id,
                  isActive: true,
                },
              },
            },
          ],
        },

        take: 8,

        orderBy: {
          updatedAt: 'desc',
        },

        select: {
          id: true,
          name: true,
          status: true,
          priority: true,
          deadline: true,

          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    return {
      role: 'EMPLOYEE',

      profile: {
        id: employee.id,
        employeeId:
          employee.employeeId,
        username:
          employee.username,
        fullName:
          employee.fullName,
        designation:
          employee.designation,
        profileImageUrl:
          employee.profileImageUrl,
        department:
          employee.department,

        reportingManager:
          employee.reportingManager,
      },

      stats: {
        totalTasks,
        dueToday,
        overdue,
        inProgress,
        waitingReview,
        completed,
        criticalTasks,
        projects:
          projects.length,
      },

      recentTasks,
      projects,
    };
  }
}