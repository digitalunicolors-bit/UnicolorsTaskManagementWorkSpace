import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { TaskWorkflowActionDto } from './dto/task-workflow-action.dto';
import {
  ApprovalStatus,
  EmploymentStatus,
  NotificationKind,
  Priority,
  ProjectStatus,
  ProjectReviewStage,
  TimeEntryStatus,
} from '../generated/prisma/enums';

import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { AddTaskAssigneesDto } from './dto/add-task-assignees.dto';
import { RemoveTaskPeopleDto } from './dto/remove-task-people.dto';
import { AddTaskCollaboratorsDto } from './dto/add-task-collaborators.dto';
import { AddTaskReviewersDto } from './dto/add-task-reviewers.dto';
import { NotificationsService } from '../notifications/notifications.service';
@Injectable()
export class TasksService {
 constructor(
  private readonly prisma: PrismaService,
  private readonly notifications:
    NotificationsService,
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
  private async assertProjectAccessible(
    projectId: string,
    userId: string,
  ) {
    const roles = await this.prisma.userRole.findMany({
      where: {
        userId,
        role: { isActive: true },
      },
      select: { role: { select: { name: true } } },
    });

    const roleNames = roles.map((item) => item.role.name);
    if (roleNames.includes('SUPER_ADMIN') || roleNames.includes('ADMIN')) {
      return;
    }

    const employee = await this.prisma.employeeProfile.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });

    if (!employee) {
      throw new ForbiddenException('You cannot use this project.');
    }

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        OR: [
          { projectManagerId: employee.id },
          {
            department: {
              headId: employee.id,
            },
          },
          {
            projectDepartments: {
              some: {
                department: {
                  headId: employee.id,
                },
              },
            },
          },
          {
            members: {
              some: {
                employeeId: employee.id,
                isActive: true,
                leftAt: null,
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    if (!project) {
      throw new ForbiddenException('You cannot use this project.');
    }
  }

  private async assertTaskDepartmentAllowed(
    projectId: string,
    departmentId: string | undefined,
    userId: string,
  ) {
    const userRoles =
      await this.prisma.userRole.findMany({
        where: {
          userId,
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
      });

    const roles = userRoles.map(
      (item) => item.role.name,
    );

    if (
      roles.includes('SUPER_ADMIN') ||
      roles.includes('ADMIN')
    ) {
      return;
    }

    if (!roles.includes('MANAGER')) {
      throw new ForbiddenException(
        'Only the relevant Department HOD/Manager can create this task.',
      );
    }

    if (!departmentId) {
      throw new BadRequestException(
        'Select the department responsible for this task.',
      );
    }

    const employee =
      await this.prisma.employeeProfile.findFirst({
        where: {
          userId,
          deletedAt: null,
        },
        select: {
          id: true,
          managedDepartments: {
            where: {
              isActive: true,
              deletedAt: null,
            },
            select: {
              id: true,
            },
          },
        },
      });

    if (!employee) {
      throw new ForbiddenException(
        'You cannot create tasks for this project.',
      );
    }

    const managedDepartmentIds =
      new Set(
        employee.managedDepartments.map(
          (department) => department.id,
        ),
      );

    if (!managedDepartmentIds.has(departmentId)) {
      throw new ForbiddenException(
        'You can create tasks only for a department you manage.',
      );
    }

    const projectDepartment =
      await this.prisma.project.findFirst({
        where: {
          id: projectId,
          deletedAt: null,
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
        select: {
          id: true,
        },
      });

    if (!projectDepartment) {
      throw new ForbiddenException(
        'This department is not assigned to the selected project.',
      );
    }
  }

  private async getTaskAccessScope(
  userId: string,
): Promise<any> {
  const userRoles =
    await this.prisma.userRole.findMany({
      where: {
        userId,
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
    });

  const roles = userRoles.map(
    (item) => item.role.name,
  );

  // Super Admin + Admin = company-wide access
  if (
    roles.includes('SUPER_ADMIN') ||
    roles.includes('ADMIN')
  ) {
    return {};
  }

  const employee =
    await this.prisma.employeeProfile.findFirst({
      where: {
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

  if (!employee) {
    return {
      id: '__NO_TASK_ACCESS__',
    };
  }

  // Manager = own team + managed projects + reviewer work
  if (roles.includes('MANAGER')) {
    const directReports =
      await this.prisma.employeeProfile.findMany({
        where: {
          reportingManagerId:
            employee.id,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

    const teamEmployeeIds = [
      employee.id,
      ...directReports.map(
        (item) => item.id,
      ),
    ];

    const managedProjects =
      await this.prisma.project.findMany({
        where: {
          deletedAt: null,
          OR: [
            {
              projectManagerId:
                employee.id,
            },
            {
              department: {
                headId: employee.id,
              },
            },
            {
              projectDepartments: {
                some: {
                  department: {
                    headId: employee.id,
                  },
                },
              },
            },
          ],
        },
        select: {
          id: true,
        },
      });

    return {
      OR: [
        {
          projectId: {
            in: managedProjects.map(
              (item) => item.id,
            ),
          },
        },

        {
          assignees: {
            some: {
              employeeId: {
                in: teamEmployeeIds,
              },
              removedAt: null,
            },
          },
        },

        {
          collaborators: {
            some: {
              employeeId: {
                in: teamEmployeeIds,
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
      ],
    };
  }

  // Employee = only assigned/collaborating tasks
  return {
    OR: [
      {
        assignees: {
          some: {
            employeeId:
              employee.id,
            removedAt: null,
          },
        },
      },

      {
        collaborators: {
          some: {
            employeeId:
              employee.id,
            removedAt: null,
          },
        },
      },
    ],
  };
}

private async applyTaskAccessScope(
  where: any,
  userId: string,
) {
  const scope =
    await this.getTaskAccessScope(
      userId,
    );

  if (
    Object.keys(scope).length === 0
  ) {
    return where;
  }

  return {
    AND: [
      where,
      scope,
    ],
  };
}

async findOneForUser(
  taskId: string,
  userId: string,
) {
  const where =
    await this.applyTaskAccessScope(
      {
        id: taskId,
        deletedAt: null,
      },
      userId,
    );

  const visible =
    await this.prisma.task.findFirst({
      where,
      select: {
        id: true,
      },
    });

  if (!visible) {
    throw new NotFoundException(
      'Task not found.',
    );
  }
  

  return this.findOne(taskId);
}

private async assertTaskVisible(
  taskId: string,
  userId: string,
) {
  const where =
    await this.applyTaskAccessScope(
      {
        id: taskId,
        deletedAt: null,
      },
      userId,
    );

  const task =
    await this.prisma.task.findFirst({
      where,
      select: {
        id: true,
      },
    });

  if (!task) {
    throw new NotFoundException(
      'Task not found.',
    );
  }
}

  private clean(
    value?: string | null,
  ): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();

    return trimmed || null;
  }

  private parseDate(
    value?: string | null,
  ): Date | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(
        `Invalid date: ${value}`,
      );
    }

    return date;
  }

  private unique(ids?: string[]) {
    return [...new Set(ids ?? [])];
  }

  private normalizeDepartmentName(
    value?: string | null,
  ) {
    return (value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  private async buildReviewerOptions(
    projectId?: string,
  ) {
    const reviewerIds = new Set<string>();

    const privilegedReviewers =
      await this.prisma.employeeProfile.findMany({
        where: {
          deletedAt: null,
          user: {
            isActive: true,
            deletedAt: null,
            roles: {
              some: {
                role: {
                  isActive: true,
                  name: {
                    in: ['ADMIN', 'SUPER_ADMIN'],
                  },
                },
              },
            },
          },
        },
        select: {
          id: true,
        },
      });

    privilegedReviewers.forEach((item) =>
      reviewerIds.add(item.id),
    );

    const activeDepartments =
      await this.prisma.department.findMany({
        where: {
          deletedAt: null,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          headId: true,
        },
      });

    const clientServicingDepartment =
      activeDepartments.find((department) => {
        const normalized =
          this.normalizeDepartmentName(
            department.name,
          );

        return (
          normalized === 'clientservicing' ||
          normalized === 'clientservice'
        );
      });

    if (clientServicingDepartment?.headId) {
      reviewerIds.add(
        clientServicingDepartment.headId,
      );
    }

    if (projectId) {
      const project =
        await this.prisma.project.findFirst({
          where: {
            id: projectId,
            deletedAt: null,
          },
          select: {
            departmentId: true,
            projectDepartments: {
              select: {
                departmentId: true,
              },
            },
          },
        });

      if (!project) {
        throw new BadRequestException(
          'Project not found.',
        );
      }

      const departmentIds = new Set<string>();

      if (project.departmentId) {
        departmentIds.add(project.departmentId);
      }

      project.projectDepartments.forEach(
        (item) =>
          departmentIds.add(
            item.departmentId,
          ),
      );

      activeDepartments
        .filter((department) =>
          departmentIds.has(department.id),
        )
        .forEach((department) => {
          if (department.headId) {
            reviewerIds.add(department.headId);
          }
        });
    }

    if (!reviewerIds.size) {
      return [];
    }

    return this.prisma.employeeProfile.findMany({
      where: {
        id: {
          in: [...reviewerIds],
        },
        deletedAt: null,
        user: {
          isActive: true,
          deletedAt: null,
        },
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
      },
      orderBy: {
        fullName: 'asc',
      },
    });
  }

  async getReviewerOptions(
    userId: string,
    projectId?: string,
  ) {
    if (projectId) {
      await this.assertProjectAccessible(
        projectId,
        userId,
      );
    }

    return this.buildReviewerOptions(projectId);
  }

  private async validateReviewerEligibility(
    reviewerIds: string[],
    projectId: string,
  ) {
    if (!reviewerIds.length) {
      return;
    }

    const options =
      await this.buildReviewerOptions(
        projectId,
      );

    const allowedIds = new Set(
      options.map((item) => item.id),
    );

    const invalidIds = reviewerIds.filter(
      (id) => !allowedIds.has(id),
    );

    if (invalidIds.length) {
      throw new BadRequestException(
        'Reviewer must be Client Servicing HOD, relevant Department HOD, Admin or Super Admin.',
      );
    }
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
        },
      });

    if (!client) {
      throw new BadRequestException(
        'Client not found or inactive.',
      );
    }

    return client;
  }

  private async validateProject(
    projectId: string,
    clientId: string,
  ) {
    const project =
      await this.prisma.project.findFirst({
        where: {
          id: projectId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          clientId: true,
          priority: true,
        },
      });

    if (!project) {
      throw new BadRequestException(
        'Project not found.',
      );
    }

    if (project.clientId !== clientId) {
      throw new BadRequestException(
        'Selected project does not belong to selected client.',
      );
    }

    return project;
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

  private async validateCategory(
    categoryId?: string | null,
  ) {
    if (!categoryId) {
      return null;
    }

    const category =
      await this.prisma.taskCategory.findFirst({
        where: {
          id: categoryId,
          deletedAt: null,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
        },
      });

    if (!category) {
      throw new BadRequestException(
        'Task category not found or inactive.',
      );
    }

    return category;
  }

  private async validateStatus(
    statusId?: string,
  ) {
    if (statusId) {
      const status =
        await this.prisma.taskStatus.findFirst({
          where: {
            id: statusId,
            deletedAt: null,
            isActive: true,
          },
        });

      if (!status) {
        throw new BadRequestException(
          'Task status not found or inactive.',
        );
      }

      return status;
    }

    const defaultStatus =
      await this.prisma.taskStatus.findFirst({
        where: {
          deletedAt: null,
          isActive: true,
        },
        orderBy: [
          {
            sortOrder: 'asc',
          },
          {
            createdAt: 'asc',
          },
        ],
      });

    if (!defaultStatus) {
      throw new BadRequestException(
        'No active task status is configured.',
      );
    }

    return defaultStatus;
  }

  private async validateEmployees(
    employeeIds: string[],
  ) {
    const uniqueIds =
      this.unique(employeeIds);

    if (!uniqueIds.length) {
      return [];
    }

    const employees =
      await this.prisma.employeeProfile.findMany({
        where: {
          id: {
            in: uniqueIds,
          },
          deletedAt: null,
          employmentStatus:
            EmploymentStatus.ACTIVE,
          user: {
            isActive: true,
            deletedAt: null,
          },
        },
        select: {
          id: true,
          employeeId: true,
          fullName: true,
        },
      });

    if (
      employees.length !== uniqueIds.length
    ) {
      const foundIds = new Set(
        employees.map(
          (employee) => employee.id,
        ),
      );

      const missing =
        uniqueIds.filter(
          (id) =>
            !foundIds.has(id),
        );

      throw new BadRequestException(
        `Employee not found or inactive: ${missing.join(', ')}`,
      );
    }

    return employees;
  }

  async getMeta() {
    const [
      statuses,
      categories,
    ] = await Promise.all([
      this.prisma.taskStatus.findMany({
        where: {
          isActive: true,
          deletedAt: null,
        },
        orderBy: [
          {
            sortOrder: 'asc',
          },
          {
            name: 'asc',
          },
        ],
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          color: true,
          sortOrder: true,
        },
      }),

      this.prisma.taskCategory.findMany({
        where: {
          isActive: true,
          deletedAt: null,
        },
        orderBy: {
          name: 'asc',
        },
        select: {
          id: true,
          name: true,
          description: true,
          color: true,
        },
      }),
    ]);

    return {
      statuses,
      categories,
      priorities: Object.values(
        Priority,
      ),
    };
  }

  async findAll(
    query: TaskQueryDto,
    userId: string,
  ) {
    const page =
      query.page ?? 1;

    const limit =
      query.limit ?? 25;

    const skip =
      (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };
    const scopedWhere =
  await this.applyTaskAccessScope(
    where,
    userId,
  );

    if (query.search?.trim()) {
      const search =
        query.search.trim();

      where.OR = [
        {
          title: {
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
          internalNotes: {
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
        {
          project: {
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
        query.clientId;
    }

    if (query.projectId) {
      where.projectId =
        query.projectId;
    }

    if (query.departmentId) {
      where.departmentId =
        query.departmentId;
    }

    if (query.categoryId) {
      where.categoryId =
        query.categoryId;
    }

    if (query.statusId) {
      where.statusId =
        query.statusId;
    }

    if (query.createdById) {
      where.createdById =
        query.createdById;
    }

    if (query.priority) {
      where.priority =
        query.priority;
    }

    if (
      query.isDraft !== undefined
    ) {
      where.isDraft =
        query.isDraft;
    }

    if (
      query.isCritical !== undefined
    ) {
      where.isCritical =
        query.isCritical;
    }

    if (query.assigneeId) {
      where.assignees = {
        some: {
          employeeId:
            query.assigneeId,
          removedAt: null,
        },
      };
    }

    if (
      query.dueFrom ||
      query.dueTo
    ) {
      where.dueAt = {};

      if (query.dueFrom) {
        where.dueAt.gte =
          this.parseDate(
            query.dueFrom,
          );
      }

      if (query.dueTo) {
        where.dueAt.lte =
          this.parseDate(
            query.dueTo,
          );
      }
    }

    if (query.overdue === true) {
      where.dueAt = {
        lt: new Date(),
      };

      where.status = {
        code: {
          notIn: [
            'DONE',
            'COMPLETED',
            'CANCELLED',
            'ARCHIVED',
          ],
        },
      };
    }

    if (query.overdue === false) {
      where.OR = [
        ...(where.OR ?? []),
        {
          dueAt: null,
        },
        {
          dueAt: {
            gte: new Date(),
          },
        },
      ];
    }

    const sortBy =
      query.sortBy ??
      'createdAt';

    const sortOrder =
      query.sortOrder ??
      'desc';

    const orderBy: any = {
      [sortBy]: sortOrder,
    };

    const [
      data,
      total,
    ] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where: scopedWhere,
        skip,
        take: limit,
        orderBy,
        include: {
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
              status: true,
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

          createdBy: {
            select: {
              id: true,
              email: true,
              phone: true,
              employeeProfile: {
                select: {
                  id: true,
                  fullName: true,
                  employeeId: true,
                  profileImageUrl: true,
                },
              },
            },
          },

          assignees: {
            where: {
              removedAt: null,
            },
            orderBy: [
              {
                isPrimary: 'desc',
              },
              {
                assignedAt: 'asc',
              },
            ],
            include: {
              employee: {
                select: {
                  id: true,
                  employeeId: true,
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
            include: {
              employee: {
                select: {
                  id: true,
                  employeeId: true,
                  fullName: true,
                  designation: true,
                  profileImageUrl: true,
                },
              },
            },
          },

          reviewers: {
            orderBy: {
              sortOrder: 'asc',
            },
            include: {
              employee: {
                select: {
                  id: true,
                  employeeId: true,
                  fullName: true,
                  designation: true,
                  profileImageUrl: true,
                },
              },
            },
          },

          _count: {
            select: {
              subtasks: true,
              checklist: true,
              comments: true,
              files: true,
              approvals: true,
              timeEntries: true,
            },
          },
        },
      }),

      this.prisma.task.count({
        where: scopedWhere,
      }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages:
          Math.ceil(
            total / limit,
          ),
      },
    };
  }

  private async getLoggedTimeSeconds(taskId: string): Promise<number> {
    const [aggregate, runningEntries] = await Promise.all([
      this.prisma.timeEntry.aggregate({
        where: {
          taskId,
          deletedAt: null,
        },
        _sum: {
          durationSeconds: true,
        },
      }),
      this.prisma.timeEntry.findMany({
        where: {
          taskId,
          deletedAt: null,
          status: TimeEntryStatus.RUNNING,
          activeStartedAt: { not: null },
        },
        select: {
          activeStartedAt: true,
        },
      }),
    ]);

    const now = Date.now();
    const liveSeconds = runningEntries.reduce((total, entry) => {
      if (!entry.activeStartedAt) return total;
      return (
        total +
        Math.max(
          0,
          Math.floor((now - entry.activeStartedAt.getTime()) / 1000),
        )
      );
    }, 0);

    return (aggregate._sum.durationSeconds ?? 0) + liveSeconds;
  }

  async findOne(
    id: string,
  ) {
    const task =
      await this.prisma.task.findFirst({
        where: {
          id,
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

          project: {
            select: {
              id: true,
              name: true,
              description: true,
              status: true,
              deadline: true,
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
              description: true,
            },
          },

          status: true,

          createdBy: {
            select: {
              id: true,
              email: true,
              phone: true,
              employeeProfile: {
                select: {
                  id: true,
                  employeeId: true,
                  fullName: true,
                  designation: true,
                  profileImageUrl: true,
                },
              },
            },
          },

          assignees: {
            where: {
              removedAt: null,
            },
            orderBy: [
              {
                isPrimary: 'desc',
              },
              {
                assignedAt: 'asc',
              },
            ],
            include: {
              employee: {
                select: {
                  id: true,
                  employeeId: true,
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
            include: {
              employee: {
                select: {
                  id: true,
                  employeeId: true,
                  fullName: true,
                  designation: true,
                  profileImageUrl: true,
                },
              },
            },
          },

          followers: {
            include: {
              employee: {
                select: {
                  id: true,
                  employeeId: true,
                  fullName: true,
                },
              },
            },
          },

          reviewers: {
            orderBy: {
              sortOrder: 'asc',
            },
            include: {
              employee: {
                select: {
                  id: true,
                  employeeId: true,
                  fullName: true,
                  designation: true,
                  profileImageUrl: true,
                },
              },
            },
          },

          tags: {
            include: {
              tag: true,
            },
          },

          subtasks: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              sortOrder: 'asc',
            },
          },

          checklist: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              sortOrder: 'asc',
            },
          },

          dependencies: {
            include: {
              dependsOn: {
                select: {
                  id: true,
                  title: true,
                  status: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },

          approvals: {
            orderBy: {
              requestedAt: 'desc',
            },
            select: {
              id: true,
              reviewerId: true,
              status: true,
              decisionNote: true,
              requestedAt: true,
              decidedAt: true,
              reviewer: {
                select: {
                  id: true,
                  employeeId: true,
                  fullName: true,
                  designation: true,
                },
              },
              decidedBy: {
                select: {
                  id: true,
                  employeeProfile: {
                    select: {
                      id: true,
                      fullName: true,
                    },
                  },
                },
              },
            },
          },

          statusHistory: {
            orderBy: {
              createdAt: 'desc',
            },
            include: {
              fromStatus: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
              toStatus: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
              changedBy: {
                select: {
                  id: true,
                  employeeProfile: {
                    select: {
                      id: true,
                      fullName: true,
                    },
                  },
                },
              },
            },
          },

          _count: {
            select: {
              subtasks: true,
              checklist: true,
              comments: true,
              files: true,
              approvals: true,
              timeEntries: true,
            },
          },
        },
      });

    if (!task) {
      throw new NotFoundException(
        'Task not found.',
      );
    }

    const loggedTimeSeconds = await this.getLoggedTimeSeconds(id);

    return {
      ...task,
      loggedTimeSeconds,
    };
  }

  async create(
    dto: CreateTaskDto,
    createdById: string,
  ) {
    if (!dto.title.trim()) {
      throw new BadRequestException('Task title is required.');
    }

    await this.validateClient(
      dto.clientId,
    );

    const project =
      await this.validateProject(
        dto.projectId,
        dto.clientId,
      );

    await this.assertProjectAccessible(
      dto.projectId,
      createdById,
    );

    await this.validateDepartment(
      dto.departmentId,
    );

    await this.assertTaskDepartmentAllowed(
      dto.projectId,
      dto.departmentId,
      createdById,
    );

    await this.validateCategory(
      dto.categoryId,
    );

    const status =
      await this.validateStatus(
        dto.statusId,
      );

    const assigneeIds =
      this.unique(
        dto.assigneeIds,
      );

    if (
      dto.primaryAssigneeId &&
      !assigneeIds.includes(
        dto.primaryAssigneeId,
      )
    ) {
      assigneeIds.push(
        dto.primaryAssigneeId,
      );
    }

    const collaboratorIds =
      this.unique(
        dto.collaboratorIds,
      );

    const reviewerIds =
      this.unique(
        dto.reviewerIds,
      );

    await this.validateEmployees([
      ...assigneeIds,
      ...collaboratorIds,
      ...reviewerIds,
    ]);

    await this.validateReviewerEligibility(
      reviewerIds,
      dto.projectId,
    );

    const taskId =
      await this.prisma.$transaction(
        async (tx) => {
          const task =
            await tx.task.create({
              data: {
                title:
                  dto.title.trim(),

                description:
                  this.clean(
                    dto.description,
                  ),

                clientId:
                  dto.clientId,

                projectId:
                  dto.projectId,

                departmentId:
                  dto.departmentId ??
                  null,

                categoryId:
                  dto.categoryId ??
                  null,

                statusId:
                  status.id,

                createdById,

                priority:
                  dto.priority ??
                  Priority.HIGH,

                // Start date is system-managed: creation time.
                startDate: new Date(),

                dueAt:
                  this.parseDate(
                    dto.dueAt,
                  ),

                estimatedHours:
                  dto.estimatedHours ===
                  undefined
                    ? null
                    : dto.estimatedHours.toString(),

                internalNotes:
                  this.clean(
                    dto.internalNotes,
                  ),

                isDraft:
                  dto.isDraft ??
                  false,

                isCritical:
                  dto.isCritical ??
                  false,

                assignees: {
                  create:
                    assigneeIds.map(
                      (
                        employeeId,
                      ) => ({
                        employeeId,

                        isPrimary:
                          dto.primaryAssigneeId
                            ? employeeId ===
                              dto.primaryAssigneeId
                            : employeeId ===
                              assigneeIds[0],
                      }),
                    ),
                },

                collaborators: {
                  create:
                    collaboratorIds.map(
                      (
                        employeeId,
                      ) => ({
                        employeeId,
                      }),
                    ),
                },

                reviewers: {
                  create:
                    reviewerIds.map(
                      (
                        employeeId,
                        index,
                      ) => ({
                        employeeId,
                        sortOrder:
                          index,
                        isRequired:
                          true,
                      }),
                    ),
                },
              },

              select: {
                id: true,
              },
            });

          await tx.taskStatusHistory.create({
            data: {
              taskId: task.id,
              fromStatusId: null,
              toStatusId:
                status.id,
              changedById:
                createdById,
              reason:
                'Task created',
            },
          });

          return task.id;
        },
      );

    if (
      dto.notifyAssignee !== false &&
      assigneeIds.length > 0
    ) {
      await this.notifications.notifyEmployees(
        assigneeIds,
        {
          actorId: createdById,
          kind: dto.isCritical
            ? NotificationKind.TASK_CRITICAL_ASSIGNED
            : NotificationKind.TASK_ASSIGNED,
          title: dto.isCritical
            ? 'Critical task assigned'
            : 'New task assigned',
          message: dto.title.trim(),
          entityType: 'TASK',
          entityId: taskId,
          redirectPath: `/tasks?task=${taskId}`,
        },
      );
    }

    return this.findOne(taskId);
  }
  
  async update(
    id: string,
    dto: UpdateTaskDto,
    changedById: string,
  ) {
    if (dto.title !== undefined && !dto.title.trim()) {
      throw new BadRequestException('Task title is required.');
    }

    await this.assertTaskVisible(
  id,
  changedById,
   );
    const existing =
      await this.prisma.task.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        select: {
          id: true,
          clientId: true,
          projectId: true,
          departmentId: true,
          categoryId: true,
          statusId: true,
        },
      });
      

    if (!existing) {
      throw new NotFoundException(
        'Task not found.',
      );
    }
     if (
    dto.statusId !== undefined &&
    dto.statusId !== existing.statusId
  ) {
    throw new BadRequestException(
      'Task status cannot be changed from general edit. Use workflow actions.',
    );
  }


    const clientId =
      dto.clientId ??
      existing.clientId;

    const projectId =
      dto.projectId ??
      existing.projectId;

    if (
      dto.clientId ||
      dto.projectId
    ) {
      await this.validateClient(
        clientId,
      );

      await this.validateProject(
        projectId,
        clientId,
      );

      if (dto.projectId !== undefined && dto.projectId !== existing.projectId) {
        await this.assertProjectAccessible(projectId, changedById);
      }
    }

    if (
      dto.departmentId !==
      undefined
    ) {
      await this.validateDepartment(
        dto.departmentId,
      );
    }

    if (
      dto.categoryId !==
      undefined
    ) {
      await this.validateCategory(
        dto.categoryId,
      );
    }

    if (dto.statusId) {
      await this.validateStatus(
        dto.statusId,
      );
    }

    await this.prisma.$transaction(
      async (tx) => {
        const data: any = {};

        if (
          dto.title !== undefined
        ) {
          data.title =
            dto.title.trim();
        }

        if (
          dto.description !==
          undefined
        ) {
          data.description =
            this.clean(
              dto.description,
            );
        }

        if (
          dto.clientId !==
          undefined
        ) {
          data.clientId =
            dto.clientId;
        }

        if (
          dto.projectId !==
          undefined
        ) {
          data.projectId =
            dto.projectId;
        }

        if (
          dto.departmentId !==
          undefined
        ) {
          data.departmentId =
            dto.departmentId ||
            null;
        }

        if (
          dto.categoryId !==
          undefined
        ) {
          data.categoryId =
            dto.categoryId ||
            null;
        }

        if (
          dto.statusId !==
          undefined
        ) {
          data.statusId =
            dto.statusId;
        }

        if (
          dto.priority !==
          undefined
        ) {
          data.priority =
            dto.priority;
        }

        if (
          dto.dueAt !==
          undefined
        ) {
          data.dueAt =
            this.parseDate(
              dto.dueAt,
            );
        }

        if (
          dto.estimatedHours !==
          undefined
        ) {
          data.estimatedHours =
            dto.estimatedHours ===
            null
              ? null
              : dto.estimatedHours.toString();
        }

        if (
          dto.internalNotes !==
          undefined
        ) {
          data.internalNotes =
            this.clean(
              dto.internalNotes,
            );
        }

        if (
          dto.isDraft !==
          undefined
        ) {
          data.isDraft =
            dto.isDraft;
        }

        if (
          dto.isCritical !==
          undefined
        ) {
          data.isCritical =
            dto.isCritical;
        }

        await tx.task.update({
          where: {
            id,
          },
          data,
        });

        if (
          dto.statusId &&
          dto.statusId !==
            existing.statusId
        ) {
          await tx.taskStatusHistory.create({
            data: {
              taskId: id,
              fromStatusId:
                existing.statusId,
              toStatusId:
                dto.statusId,
              changedById,
              reason:
                this.clean(
                  dto.statusChangeReason,
                ),
            },
          });
        }
      },
    );

    return this.findOne(id);
  }
     private async getWorkflowStatus(
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
        },
      });

    if (!status) {
      throw new BadRequestException(
        `Task status "${code}" not found.`,
      );
    }

    return status;
  }

  private async getWorkflowTask(
    taskId: string,
  ) {
    const task =
      await this.prisma.task.findFirst({
        where: {
          id: taskId,
          deletedAt: null,
        },
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

  private async getEmployeeForUser(
    userId: string,
  ) {
    return this.prisma.employeeProfile.findFirst({
      where: {
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });
  }

  private async assertCanWorkOnTask(
    task: Awaited<
      ReturnType<
        TasksService['getWorkflowTask']
      >
    >,
    userId: string,
  ) {
    if (task.createdById === userId) {
      return;
    }

    const employee =
      await this.getEmployeeForUser(
        userId,
      );

    if (!employee) {
      throw new ForbiddenException(
        'Employee profile not found.',
      );
    }

    const canWork =
      task.assignees.some(
        (item) =>
          item.employeeId === employee.id,
      ) ||
      task.collaborators.some(
        (item) =>
          item.employeeId === employee.id,
      );

    if (!canWork) {
      throw new ForbiddenException(
        'You are not assigned to this task.',
      );
    }
  }

  private async assertReviewer(
    task: Awaited<
      ReturnType<
        TasksService['getWorkflowTask']
      >
    >,
    userId: string,
  ) {
    const employee =
      await this.getEmployeeForUser(
        userId,
      );

    if (!employee) {
      throw new ForbiddenException(
        'Employee profile not found.',
      );
    }

    const reviewer =
      task.reviewers.find(
        (item) =>
          item.employeeId === employee.id,
      );

    if (!reviewer) {
      throw new ForbiddenException(
        'You are not assigned as a reviewer for this task.',
      );
    }

    return employee;
  }

  private async ensureTransition(
    fromStatusId: string,
    toStatusId: string,
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
        },
      });

    if (!transition) {
      throw new BadRequestException(
        'This workflow transition is not allowed.',
      );
    }

    return transition;
  }

  async submitForReview(
    taskId: string,
    userId: string,
    dto: TaskWorkflowActionDto,
  ) {
    const task =
      await this.getWorkflowTask(
        taskId,
      );

    if (task.isDraft) {
      throw new BadRequestException(
        'Draft task cannot be submitted for review.',
      );
    }

    await this.assertCanWorkOnTask(
      task,
      userId,
    );

    if (!task.reviewers.length) {
      throw new BadRequestException(
        'Assign at least one reviewer before submitting the task.',
      );
    }

    const reviewStatus =
      await this.getWorkflowStatus(
        'REVIEW',
      );

    await this.ensureTransition(
      task.statusId,
      reviewStatus.id,
    );

    const now = new Date();

    await this.prisma.$transaction(
      async (tx) => {
        await tx.taskApproval.updateMany({
          where: {
            taskId,
            status:
              ApprovalStatus.PENDING,
          },
          data: {
            status:
              ApprovalStatus.CANCELLED,
            decidedById: userId,
            decidedAt: now,
            decisionNote:
              'Superseded by a new review request.',
          },
        });

        await tx.task.update({
          where: {
            id: taskId,
          },
          data: {
            statusId:
              reviewStatus.id,
          },
        });

        await tx.taskStatusHistory.create({
          data: {
            taskId,
            fromStatusId:
              task.statusId,
            toStatusId:
              reviewStatus.id,
            changedById:
              userId,
            reason:
              this.clean(dto.note) ??
              'Submitted for review',
          },
        });

        await tx.taskApproval.createMany({
          data: task.reviewers.map(
            (reviewer) => ({
              taskId,
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
      taskId,
      userId,
      NotificationKind.TASK_SUBMITTED_FOR_REVIEW,
      'Task submitted for review',
      'A task is waiting for your review.',
    );

    return this.findOne(taskId);
  }

  async requestChanges(
    taskId: string,
    userId: string,
    dto: TaskWorkflowActionDto,
  ) {
    const task =
      await this.getWorkflowTask(
        taskId,
      );

    const employee =
      await this.assertReviewer(
        task,
        userId,
      );

    const changesStatus =
      await this.getWorkflowStatus(
        'CHANGES_REQUESTED',
      );

    await this.ensureTransition(
      task.statusId,
      changesStatus.id,
    );

    const approval =
      await this.prisma.taskApproval.findFirst({
        where: {
          taskId,
          reviewerId:
            employee.id,
          status:
            ApprovalStatus.PENDING,
        },
        orderBy: {
          requestedAt: 'desc',
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

    const now = new Date();
    const note =
      this.clean(dto.note) ??
      'Changes requested';

    await this.prisma.$transaction(
      async (tx) => {
        await tx.taskApproval.update({
          where: {
            id: approval.id,
          },
          data: {
            status:
              ApprovalStatus.CHANGES_REQUESTED,
            decidedById: userId,
            decidedAt: now,
            decisionNote: note,
          },
        });

        await tx.taskApproval.updateMany({
          where: {
            taskId,
            id: {
              not: approval.id,
            },
            status:
              ApprovalStatus.PENDING,
          },
          data: {
            status:
              ApprovalStatus.CANCELLED,
            decidedById: userId,
            decidedAt: now,
            decisionNote:
              'Review cycle closed because changes were requested.',
          },
        });

        await tx.task.update({
          where: {
            id: taskId,
          },
          data: {
            statusId:
              changesStatus.id,
          },
        });

        await tx.taskStatusHistory.create({
          data: {
            taskId,
            fromStatusId:
              task.statusId,
            toStatusId:
              changesStatus.id,
            changedById:
              userId,
            reason: note,
          },
        });
      },
    );

    await this.syncProjectStatusFromTasks(
      task.projectId,
    );

    await this.notifications.notifyTaskAssignees(
      taskId,
      userId,
      NotificationKind.TASK_CHANGES_REQUESTED,
      'Changes requested',
      note,
    );

    return this.findOne(taskId);
  }

  async resumeAfterChanges(
    taskId: string,
    userId: string,
    dto: TaskWorkflowActionDto,
  ) {
    const task =
      await this.getWorkflowTask(
        taskId,
      );

    await this.assertCanWorkOnTask(
      task,
      userId,
    );

    const inProgressStatus =
      await this.getWorkflowStatus(
        'IN_PROGRESS',
      );

    await this.ensureTransition(
      task.statusId,
      inProgressStatus.id,
    );

    await this.prisma.$transaction(
      async (tx) => {
        await tx.task.update({
          where: {
            id: taskId,
          },
          data: {
            statusId:
              inProgressStatus.id,
          },
        });

        await tx.taskStatusHistory.create({
          data: {
            taskId,
            fromStatusId:
              task.statusId,
            toStatusId:
              inProgressStatus.id,
            changedById:
              userId,
            reason:
              this.clean(dto.note) ??
              'Changes started',
          },
        });
      },
    );

    await this.syncProjectStatusFromTasks(
      task.projectId,
    );

    return this.findOne(taskId);
  }

  async approveTask(
    taskId: string,
    userId: string,
    dto: TaskWorkflowActionDto,
  ) {
    const task =
      await this.getWorkflowTask(
        taskId,
      );

    const employee =
      await this.assertReviewer(
        task,
        userId,
      );

    const doneStatus =
      await this.getWorkflowStatus(
        'DONE',
      );

    await this.ensureTransition(
      task.statusId,
      doneStatus.id,
    );

    const approval =
      await this.prisma.taskApproval.findFirst({
        where: {
          taskId,
          reviewerId:
            employee.id,
          status:
            ApprovalStatus.PENDING,
        },
        orderBy: {
          requestedAt: 'desc',
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
          taskId,
          toStatusId:
            task.statusId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          createdAt: true,
        },
      });

    const now = new Date();

    await this.prisma.$transaction(
      async (tx) => {
        await tx.taskApproval.update({
          where: {
            id: approval.id,
          },
          data: {
            status:
              ApprovalStatus.APPROVED,
            decidedById:
              userId,
            decidedAt: now,
            decisionNote:
              this.clean(dto.note) ??
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
              taskId,
              reviewerId: {
                in: blockingReviewers.map(
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
              requestedAt: 'desc',
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

        const allApproved =
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
              id: taskId,
            },
            data: {
              statusId:
                doneStatus.id,
            },
          });

          await tx.taskStatusHistory.create({
            data: {
              taskId,
              fromStatusId:
                task.statusId,
              toStatusId:
                doneStatus.id,
              changedById:
                userId,
              reason:
                this.clean(dto.note) ??
                'Task approved and completed',
            },
          });
        }
      },
    );

    const notificationTask =
      await this.prisma.task.findUnique({
        where: {
          id: taskId,
        },
        select: {
          status: {
            select: {
              code: true,
            },
          },
        },
      });

    await this.notifications.notifyTaskAssignees(
      taskId,
      userId,
      NotificationKind.TASK_APPROVED,
      'Task approved',
      'Your task has been approved.',
    );

    await this.syncProjectStatusFromTasks(
      task.projectId,
    );

    if (
      notificationTask?.status.code ===
      'DONE'
    ) {
      await this.notifications.notifyTaskAssignees(
        taskId,
        userId,
        NotificationKind.TASK_COMPLETED,
        'Task completed',
        'Your task has been completed successfully.',
      );
    }

    return this.findOne(taskId);
  }
  async remove(id: string, userId: string) {
    await this.assertTaskVisible(id, userId);
    const existing =
      await this.prisma.task.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

    if (!existing) {
      throw new NotFoundException(
        'Task not found.',
      );
    }
   

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.taskAssignee.updateMany({
        where: {
          taskId: id,
          removedAt: null,
        },
        data: {
          removedAt: now,
          isPrimary: false,
        },
      }),

      this.prisma.taskCollaborator.updateMany({
        where: {
          taskId: id,
          removedAt: null,
        },
        data: {
          removedAt: now,
        },
      }),

      this.prisma.task.update({
        where: {
          id,
        },
        data: {
          deletedAt: now,
        },
      }),
    ]);

    return {
      message:
        'Task deleted successfully.',
    };
  }

  async addAssignees(
    taskId: string,
    dto: AddTaskAssigneesDto,
    userId: string,
  ) {
    await this.assertTaskVisible(taskId, userId);

    await this.validateEmployees(
      dto.employeeIds,
    );

    if (
      dto.primaryEmployeeId &&
      !dto.employeeIds.includes(
        dto.primaryEmployeeId,
      )
    ) {
      await this.validateEmployees([
        dto.primaryEmployeeId,
      ]);
    }

    await this.prisma.$transaction(
      async (tx) => {
        if (
          dto.primaryEmployeeId
        ) {
          await tx.taskAssignee.updateMany({
            where: {
              taskId,
              removedAt: null,
            },
            data: {
              isPrimary: false,
            },
          });
        }

        const ids =
          this.unique([
            ...dto.employeeIds,
            ...(dto.primaryEmployeeId
              ? [
                  dto.primaryEmployeeId,
                ]
              : []),
          ]);

        for (const employeeId of ids) {
          await tx.taskAssignee.upsert({
            where: {
              taskId_employeeId: {
                taskId,
                employeeId,
              },
            },

            create: {
              taskId,
              employeeId,
              removedAt: null,
              isPrimary:
                dto.primaryEmployeeId
                  ? employeeId ===
                    dto.primaryEmployeeId
                  : false,
            },

            update: {
              removedAt: null,

              ...(dto.primaryEmployeeId
                ? {
                    isPrimary:
                      employeeId ===
                      dto.primaryEmployeeId,
                  }
                : {}),
            },
          });
        }

        const primary =
          await tx.taskAssignee.findFirst({
            where: {
              taskId,
              removedAt: null,
              isPrimary: true,
            },
          });

        if (!primary) {
          const first =
            await tx.taskAssignee.findFirst({
              where: {
                taskId,
                removedAt: null,
              },
              orderBy: {
                assignedAt: 'asc',
              },
            });

          if (first) {
            await tx.taskAssignee.update({
              where: {
                id: first.id,
              },
              data: {
                isPrimary: true,
              },
            });
          }
        }
      },
    );

    return this.findOne(taskId);
  }

  async removeAssignees(
    taskId: string,
    dto: RemoveTaskPeopleDto,
    userId: string,
  ) {
    await this.assertTaskVisible(taskId, userId);

    await this.prisma.$transaction(
      async (tx) => {
        await tx.taskAssignee.updateMany({
          where: {
            taskId,
            employeeId: {
              in: dto.employeeIds,
            },
            removedAt: null,
          },
          data: {
            removedAt:
              new Date(),
            isPrimary: false,
          },
        });

        const primary =
          await tx.taskAssignee.findFirst({
            where: {
              taskId,
              removedAt: null,
              isPrimary: true,
            },
          });

        if (!primary) {
          const first =
            await tx.taskAssignee.findFirst({
              where: {
                taskId,
                removedAt: null,
              },
              orderBy: {
                assignedAt: 'asc',
              },
            });

          if (first) {
            await tx.taskAssignee.update({
              where: {
                id: first.id,
              },
              data: {
                isPrimary: true,
              },
            });
          }
        }
      },
    );

    return this.findOne(taskId);
  }

  async addCollaborators(
    taskId: string,
    dto: AddTaskCollaboratorsDto,
    userId: string,
  ) {
    await this.assertTaskVisible(taskId, userId);

    await this.validateEmployees(
      dto.employeeIds,
    );

    await this.prisma.$transaction(
      async (tx) => {
        for (
          const employeeId of this.unique(
            dto.employeeIds,
          )
        ) {
          await tx.taskCollaborator.upsert({
            where: {
              taskId_employeeId: {
                taskId,
                employeeId,
              },
            },

            create: {
              taskId,
              employeeId,
            },

            update: {
              removedAt: null,
            },
          });
        }
      },
    );

    return this.findOne(taskId);
  }

  async removeCollaborators(
    taskId: string,
    dto: RemoveTaskPeopleDto,
    userId: string,
  ) {
    await this.assertTaskVisible(taskId, userId);

    await this.prisma.taskCollaborator.updateMany({
      where: {
        taskId,
        employeeId: {
          in: dto.employeeIds,
        },
        removedAt: null,
      },
      data: {
        removedAt:
          new Date(),
      },
    });

    return this.findOne(taskId);
  }

  async addReviewers(
    taskId: string,
    dto: AddTaskReviewersDto,
    userId: string,
  ) {
    await this.assertTaskVisible(taskId, userId);

    await this.validateEmployees(
      dto.employeeIds,
    );

    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        deletedAt: null,
      },
      select: {
        projectId: true,
      },
    });

    if (!task) {
      throw new NotFoundException(
        'Task not found.',
      );
    }

    await this.validateReviewerEligibility(
      this.unique(dto.employeeIds),
      task.projectId,
    );

    const currentCount =
      await this.prisma.taskReviewer.count({
        where: {
          taskId,
        },
      });

    await this.prisma.$transaction(
      async (tx) => {
        const ids =
          this.unique(
            dto.employeeIds,
          );

        for (
          let index = 0;
          index < ids.length;
          index += 1
        ) {
          const employeeId =
            ids[index];

          await tx.taskReviewer.upsert({
            where: {
              taskId_employeeId: {
                taskId,
                employeeId,
              },
            },

            create: {
              taskId,
              employeeId,
              sortOrder:
                currentCount +
                index,
              isRequired:
                dto.isRequired ??
                true,
            },

            update: {
              isRequired:
                dto.isRequired ??
                true,
            },
          });
        }
      },
    );

    return this.findOne(taskId);
  }

  async removeReviewers(
    taskId: string,
    dto: RemoveTaskPeopleDto,
    userId: string,
  ) {
    await this.assertTaskVisible(taskId, userId);

    await this.prisma.taskReviewer.deleteMany({
      where: {
        taskId,
        employeeId: {
          in: dto.employeeIds,
        },
      },
    });

    return this.findOne(taskId);
  }
}
