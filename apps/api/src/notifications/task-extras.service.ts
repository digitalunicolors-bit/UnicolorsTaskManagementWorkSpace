import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { NotificationKind } from '../generated/prisma/enums';
import { NotificationsService } from './notifications.service';
import {
  CompleteWorkItemDto,
  CreateChecklistItemDto,
  CreateSubtaskDto,
  ReplaceTaskDependenciesDto,
  ReplaceTaskTagsDto,
  SetupTaskStructureDto,
  UpdateChecklistItemDto,
  UpdateSubtaskDto,
  UpdateSubtaskWorkflowDto,
} from './dto/task-extras.dto';

@Injectable()
export class TaskExtrasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private clean(value?: string | null) {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed || null;
  }

  private async roles(userId: string) {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      select: {
        role: {
          select: { name: true },
        },
      },
    });

    return rows.map((item) => item.role.name);
  }

  private async employee(userId: string) {
    return this.prisma.employeeProfile.findFirst({
      where: {
        userId,
        deletedAt: null,
        user: {
          isActive: true,
          deletedAt: null,
        },
      },
      select: { id: true },
    });
  }

  private async taskScope(userId: string): Promise<any> {
    const roles = await this.roles(userId);

    if (
      roles.includes('SUPER_ADMIN') ||
      roles.includes('ADMIN')
    ) {
      return {};
    }

    const employee = await this.employee(userId);
    if (!employee) {
      return { id: '__NO_TASK_ACCESS__' };
    }

    if (roles.includes('MANAGER')) {
      const [directReports, managedProjects] = await Promise.all([
        this.prisma.employeeProfile.findMany({
          where: {
            reportingManagerId: employee.id,
            deletedAt: null,
          },
          select: { id: true },
        }),
        this.prisma.project.findMany({
          where: {
            projectManagerId: employee.id,
            deletedAt: null,
          },
          select: { id: true },
        }),
      ]);

      const teamIds = [
        employee.id,
        ...directReports.map((item) => item.id),
      ];

      return {
        OR: [
          {
            projectId: {
              in: managedProjects.map((item) => item.id),
            },
          },
          {
            assignees: {
              some: {
                employeeId: { in: teamIds },
                removedAt: null,
              },
            },
          },
          {
            collaborators: {
              some: {
                employeeId: { in: teamIds },
                removedAt: null,
              },
            },
          },
          {
            subtasks: {
              some: {
                assignedEmployeeId: { in: teamIds },
                deletedAt: null,
              },
            },
          },
          {
            reviewers: {
              some: { employeeId: employee.id },
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
              employeeId: employee.id,
              removedAt: null,
            },
          },
        },
        {
          collaborators: {
            some: {
              employeeId: employee.id,
              removedAt: null,
            },
          },
        },
        {
          subtasks: {
            some: {
              assignedEmployeeId: employee.id,
              deletedAt: null,
            },
          },
        },
      ],
    };
  }

  private async assertTaskVisible(
    taskId: string,
    userId: string,
  ) {
    const scope = await this.taskScope(userId);
    const where = Object.keys(scope).length
      ? {
          AND: [
            { id: taskId, deletedAt: null },
            scope,
          ],
        }
      : { id: taskId, deletedAt: null };

    const task = await this.prisma.task.findFirst({
      where,
      select: {
        id: true,
        projectId: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    return task;
  }

  private async assertManagerial(userId: string) {
    const roles = await this.roles(userId);
    if (
      !roles.includes('SUPER_ADMIN') &&
      !roles.includes('ADMIN') &&
      !roles.includes('MANAGER')
    ) {
      throw new ForbiddenException(
        'Only managers and administrators can change task structure.',
      );
    }
  }

  private async validateEmployee(employeeId?: string | null) {
    if (!employeeId) return null;

    const employee = await this.prisma.employeeProfile.findFirst({
      where: {
        id: employeeId,
        deletedAt: null,
        employmentStatus: 'ACTIVE',
        user: {
          isActive: true,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    if (!employee) {
      throw new BadRequestException(
        'Assigned employee was not found or is inactive.',
      );
    }

    return employee;
  }


  private async notifySubtaskAssignment(
    taskId: string,
    assignedEmployeeId: string | null | undefined,
    actorId: string,
    subtaskTitle: string,
  ) {
    if (!assignedEmployeeId) {
      return;
    }

    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        project: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!task) {
      return;
    }

    await this.notifications.notifyEmployees(
      [assignedEmployeeId],
      {
        actorId,
        kind: NotificationKind.TASK_ASSIGNED,
        title: 'Subtask assigned',
        message: `You were added to subtask "${subtaskTitle}" in task "${task.title}"${task.project?.name ? ` · ${task.project.name}` : ''}.`,
        entityType: 'TASK',
        entityId: taskId,
        redirectPath: `/tasks?task=${taskId}`,
      },
    );
  }

  private normalizeTagNames(values: string[]) {
    const seen = new Set<string>();
    const output: string[] = [];

    for (const raw of values) {
      const value = raw.trim().replace(/\s+/g, ' ');
      if (!value) continue;
      if (value.length > 80) {
        throw new BadRequestException(
          'A tag cannot be longer than 80 characters.',
        );
      }

      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(value);
    }

    return output;
  }

  private async validateDependencies(
    taskId: string,
    dependencyIds: string[],
    userId: string,
  ) {
    const ids = [...new Set(dependencyIds.filter(Boolean))];

    if (ids.includes(taskId)) {
      throw new BadRequestException(
        'A task cannot depend on itself.',
      );
    }

    if (!ids.length) return [];

    const scope = await this.taskScope(userId);
    const base: any = {
      id: { in: ids },
      deletedAt: null,
    };
    const where = Object.keys(scope).length
      ? { AND: [base, scope] }
      : base;

    const rows = await this.prisma.task.findMany({
      where,
      select: { id: true },
    });

    if (rows.length !== ids.length) {
      throw new BadRequestException(
        'One or more dependency tasks are unavailable.',
      );
    }

    return ids;
  }

  async options(userId: string, currentTaskId?: string) {
    const scope = await this.taskScope(userId);
    const base: any = {
      deletedAt: null,
      ...(currentTaskId
        ? { id: { not: currentTaskId } }
        : {}),
    };

    const where = Object.keys(scope).length
      ? { AND: [base, scope] }
      : base;

    const [tags, dependencyTasks] = await Promise.all([
      this.prisma.tag.findMany({
        orderBy: { name: 'asc' },
        take: 300,
      }),
      this.prisma.task.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: 300,
        select: {
          id: true,
          title: true,
          projectId: true,
          clientId: true,
          project: {
            select: { id: true, name: true },
          },
          client: {
            select: { id: true, name: true },
          },
          status: {
            select: { id: true, code: true, name: true },
          },
        },
      }),
    ]);

    return { tags, dependencyTasks };
  }

  async setupTask(
    taskId: string,
    userId: string,
    dto: SetupTaskStructureDto,
  ) {
    await this.assertManagerial(userId);
    await this.assertTaskVisible(taskId, userId);

    const subtasks = (dto.subtasks ?? [])
      .map((item, index) => ({
        title: item.title.trim(),
        description: this.clean(item.description),
        assignedEmployeeId: item.assignedEmployeeId || null,
        sortOrder: item.sortOrder ?? index,
      }))
      .filter((item) => item.title);

    for (const item of subtasks) {
      await this.validateEmployee(item.assignedEmployeeId);
    }

    const checklist = (dto.checklist ?? [])
      .map((item, index) => ({
        title: item.title.trim(),
        sortOrder: item.sortOrder ?? index,
      }))
      .filter((item) => item.title);

    const tagNames = this.normalizeTagNames(dto.tagNames ?? []);
    const dependencyIds = await this.validateDependencies(
      taskId,
      dto.dependencyIds ?? [],
      userId,
    );

    await this.prisma.$transaction(async (tx) => {
      if (subtasks.length) {
        await tx.subtask.createMany({
          data: subtasks.map((item) => ({
            taskId,
            ...item,
          })),
        });
      }

      if (checklist.length) {
        await tx.checklistItem.createMany({
          data: checklist.map((item) => ({
            taskId,
            ...item,
          })),
        });
      }

      for (const name of tagNames) {
        const tag = await tx.tag.upsert({
          where: { name },
          update: {},
          create: { name },
          select: { id: true },
        });

        await tx.taskTag.createMany({
          data: [{ taskId, tagId: tag.id }],
          skipDuplicates: true,
        });
      }

      if (dependencyIds.length) {
        await tx.taskDependency.createMany({
          data: dependencyIds.map((dependsOnTaskId) => ({
            taskId,
            dependsOnTaskId,
            type: 'FINISH_TO_START',
          })),
          skipDuplicates: true,
        });
      }
    });

    for (const item of subtasks) {
      await this.notifySubtaskAssignment(
        taskId,
        item.assignedEmployeeId,
        userId,
        item.title,
      );
    }

    return this.structure(taskId, userId);
  }

  async structure(taskId: string, userId: string) {
    await this.assertTaskVisible(taskId, userId);

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        id: true,
        subtasks: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            assignedEmployee: {
              select: {
                id: true,
                employeeId: true,
                fullName: true,
                username: true,
                designation: true,
              },
            },
          },
        },
        checklist: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
        tags: {
          include: { tag: true },
        },
        dependencies: {
          include: {
            dependsOn: {
              select: {
                id: true,
                title: true,
                project: { select: { id: true, name: true } },
                status: {
                  select: { id: true, code: true, name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!task) throw new NotFoundException('Task not found.');
    return task;
  }

  async createSubtask(
    taskId: string,
    userId: string,
    dto: CreateSubtaskDto,
  ) {
    await this.assertManagerial(userId);
    await this.assertTaskVisible(taskId, userId);
    await this.validateEmployee(dto.assignedEmployeeId);

    const subtask = await this.prisma.subtask.create({
      data: {
        taskId,
        title: dto.title.trim(),
        description: this.clean(dto.description),
        assignedEmployeeId: dto.assignedEmployeeId || null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    await this.notifySubtaskAssignment(
      taskId,
      subtask.assignedEmployeeId,
      userId,
      subtask.title,
    );

    return subtask;
  }

  async updateSubtask(
    id: string,
    userId: string,
    dto: UpdateSubtaskDto,
  ) {
    await this.assertManagerial(userId);

    const item = await this.prisma.subtask.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        taskId: true,
        title: true,
        assignedEmployeeId: true,
      },
    });
    if (!item) throw new NotFoundException('Subtask not found.');

    await this.assertTaskVisible(item.taskId, userId);
    if (dto.assignedEmployeeId !== undefined) {
      await this.validateEmployee(dto.assignedEmployeeId);
    }

    const subtask = await this.prisma.subtask.update({
      where: { id },
      data: {
        ...(dto.title !== undefined
          ? { title: dto.title.trim() }
          : {}),
        ...(dto.description !== undefined
          ? { description: this.clean(dto.description) }
          : {}),
        ...(dto.assignedEmployeeId !== undefined
          ? { assignedEmployeeId: dto.assignedEmployeeId || null }
          : {}),
        ...(dto.sortOrder !== undefined
          ? { sortOrder: dto.sortOrder }
          : {}),
      },
    });

    if (
      dto.assignedEmployeeId !== undefined &&
      subtask.assignedEmployeeId &&
      subtask.assignedEmployeeId !== item.assignedEmployeeId
    ) {
      await this.notifySubtaskAssignment(
        item.taskId,
        subtask.assignedEmployeeId,
        userId,
        subtask.title,
      );
    }

    return subtask;
  }

  async subtaskWorkflow(
    taskId: string,
    userId: string,
  ) {
    await this.assertTaskVisible(taskId, userId);

    const [items, roles, employee] = await Promise.all([
      this.prisma.subtask.findMany({
        where: {
          taskId,
          deletedAt: null,
        },
        select: {
          id: true,
          assignedEmployeeId: true,
          isCompleted: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      this.roles(userId),
      this.employee(userId),
    ]);

    const ids = items.map((item) => item.id);
    const logs = ids.length
      ? await this.prisma.activityLog.findMany({
          where: {
            entityType: 'SUBTASK',
            entityId: { in: ids },
            action: {
              in: [
                'SUBTASK_STARTED',
                'SUBTASK_PAUSED',
                'SUBTASK_COMPLETED',
              ],
            },
          },
          select: {
            entityId: true,
            action: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const latest = new Map<string, string>();
    for (const log of logs) {
      if (log.entityId && !latest.has(log.entityId)) {
        latest.set(log.entityId, log.action);
      }
    }

    const managerial =
      roles.includes('SUPER_ADMIN') ||
      roles.includes('ADMIN') ||
      roles.includes('MANAGER');

    return {
      items: items.map((item) => {
        const action = latest.get(item.id);
        const status = item.isCompleted
          ? 'COMPLETED'
          : action === 'SUBTASK_STARTED'
            ? 'STARTED'
            : action === 'SUBTASK_PAUSED'
              ? 'PAUSED'
              : 'PENDING';

        return {
          id: item.id,
          status,
          canControl:
            managerial ||
            Boolean(
              employee?.id &&
              item.assignedEmployeeId === employee.id,
            ),
        };
      }),
    };
  }

  async updateSubtaskWorkflow(
    id: string,
    userId: string,
    dto: UpdateSubtaskWorkflowDto,
  ) {
    const item = await this.prisma.subtask.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        title: true,
        taskId: true,
        assignedEmployeeId: true,
        isCompleted: true,
        task: {
          select: {
            title: true,
            createdById: true,
            department: {
              select: {
                head: {
                  select: { userId: true },
                },
              },
            },
            reviewers: {
              select: {
                employee: {
                  select: { userId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Subtask not found.');
    }

    await this.assertTaskVisible(item.taskId, userId);

    const [roles, employee] = await Promise.all([
      this.roles(userId),
      this.employee(userId),
    ]);

    const managerial =
      roles.includes('SUPER_ADMIN') ||
      roles.includes('ADMIN') ||
      roles.includes('MANAGER');

    if (
      !managerial &&
      (!employee || employee.id !== item.assignedEmployeeId)
    ) {
      throw new ForbiddenException(
        'Only the assigned team member or their manager can update this subtask.',
      );
    }

    const now = new Date();
    const action =
      dto.status === 'STARTED'
        ? 'SUBTASK_STARTED'
        : dto.status === 'PAUSED'
          ? 'SUBTASK_PAUSED'
          : 'SUBTASK_COMPLETED';

    // One employee should have only one actively-started subtask inside the same task.
    // Starting the next subtask automatically pauses any sibling subtask that was active.
    let siblingIdsToPause: string[] = [];
    if (dto.status === 'STARTED' && item.assignedEmployeeId) {
      const siblings = await this.prisma.subtask.findMany({
        where: {
          taskId: item.taskId,
          assignedEmployeeId: item.assignedEmployeeId,
          id: { not: item.id },
          isCompleted: false,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (siblings.length) {
        const siblingIds = siblings.map((subtask) => subtask.id);
        const siblingLogs = await this.prisma.activityLog.findMany({
          where: {
            entityType: 'SUBTASK',
            entityId: { in: siblingIds },
            action: {
              in: ['SUBTASK_STARTED', 'SUBTASK_PAUSED', 'SUBTASK_COMPLETED'],
            },
          },
          select: { entityId: true, action: true },
          orderBy: { createdAt: 'desc' },
        });

        const latest = new Map<string, string>();
        for (const log of siblingLogs) {
          if (log.entityId && !latest.has(log.entityId)) {
            latest.set(log.entityId, log.action);
          }
        }

        siblingIdsToPause = siblingIds.filter(
          (siblingId) => latest.get(siblingId) === 'SUBTASK_STARTED',
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const subtask = await tx.subtask.update({
        where: { id },
        data: {
          isCompleted: dto.status === 'COMPLETED',
          completedAt:
            dto.status === 'COMPLETED' ? now : null,
        },
      });

      if (siblingIdsToPause.length) {
        await tx.activityLog.createMany({
          data: siblingIdsToPause.map((siblingId) => ({
            userId,
            action: 'SUBTASK_PAUSED',
            entityType: 'SUBTASK',
            entityId: siblingId,
            previousValue: { workflowStatus: 'STARTED' },
            newValue: { workflowStatus: 'PAUSED' },
            metadata: {
              taskId: item.taskId,
              assignedEmployeeId: item.assignedEmployeeId,
              reason: 'AUTO_PAUSED_WHEN_ANOTHER_SUBTASK_STARTED',
            },
          })),
        });
      }

      await tx.activityLog.create({
        data: {
          userId,
          action,
          entityType: 'SUBTASK',
          entityId: id,
          previousValue: {
            completed: item.isCompleted,
          },
          newValue: {
            workflowStatus: dto.status,
            completed: dto.status === 'COMPLETED',
          },
          metadata: {
            taskId: item.taskId,
            assignedEmployeeId: item.assignedEmployeeId,
            subtaskTitle: item.title,
          },
        },
      });

      return subtask;
    });

    const supervisorUserIds = Array.from(
      new Set(
        [
          item.task.createdById,
          item.task.department?.head?.userId ?? null,
          ...item.task.reviewers.map(
            (reviewer) => reviewer.employee.userId,
          ),
        ].filter((value): value is string => Boolean(value)),
      ),
    ).filter((id) => id !== userId);

    if (supervisorUserIds.length) {
      await this.notifications.notifyUsers(supervisorUserIds, {
        actorId: userId,
        kind: NotificationKind.USER_MENTIONED,
        title: `Subtask ${dto.status.toLowerCase()}`,
        message: `${item.title} · ${item.task.title}`,
        entityType: 'TASK',
        entityId: item.taskId,
        redirectPath: `/tasks?task=${item.taskId}`,
      });
    }

    return {
      ...updated,
      workflowStatus: dto.status,
    };
  }

  async completeSubtask(
    id: string,
    userId: string,
    dto: CompleteWorkItemDto,
  ) {
    const item = await this.prisma.subtask.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        taskId: true,
        assignedEmployeeId: true,
      },
    });
    if (!item) throw new NotFoundException('Subtask not found.');

    await this.assertTaskVisible(item.taskId, userId);

    const roles = await this.roles(userId);
    const managerial =
      roles.includes('SUPER_ADMIN') ||
      roles.includes('ADMIN') ||
      roles.includes('MANAGER');

    if (!managerial && item.assignedEmployeeId) {
      const employee = await this.employee(userId);
      if (!employee || employee.id !== item.assignedEmployeeId) {
        throw new ForbiddenException(
          'This subtask is assigned to another employee.',
        );
      }
    }

    return this.prisma.subtask.update({
      where: { id },
      data: {
        isCompleted: dto.isCompleted,
        completedAt: dto.isCompleted ? new Date() : null,
      },
    });
  }

  async removeSubtask(id: string, userId: string) {
    await this.assertManagerial(userId);
    const item = await this.prisma.subtask.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, taskId: true },
    });
    if (!item) throw new NotFoundException('Subtask not found.');
    await this.assertTaskVisible(item.taskId, userId);

    return this.prisma.subtask.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async createChecklist(
    taskId: string,
    userId: string,
    dto: CreateChecklistItemDto,
  ) {
    await this.assertManagerial(userId);
    await this.assertTaskVisible(taskId, userId);

    return this.prisma.checklistItem.create({
      data: {
        taskId,
        title: dto.title.trim(),
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateChecklist(
    id: string,
    userId: string,
    dto: UpdateChecklistItemDto,
  ) {
    await this.assertManagerial(userId);
    const item = await this.prisma.checklistItem.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, taskId: true },
    });
    if (!item) throw new NotFoundException('Checklist item not found.');
    await this.assertTaskVisible(item.taskId, userId);

    return this.prisma.checklistItem.update({
      where: { id },
      data: {
        ...(dto.title !== undefined
          ? { title: dto.title.trim() }
          : {}),
        ...(dto.sortOrder !== undefined
          ? { sortOrder: dto.sortOrder }
          : {}),
      },
    });
  }

  async completeChecklist(
    id: string,
    userId: string,
    dto: CompleteWorkItemDto,
  ) {
    const item = await this.prisma.checklistItem.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, taskId: true },
    });
    if (!item) throw new NotFoundException('Checklist item not found.');
    await this.assertTaskVisible(item.taskId, userId);

    return this.prisma.checklistItem.update({
      where: { id },
      data: {
        isCompleted: dto.isCompleted,
        completedAt: dto.isCompleted ? new Date() : null,
      },
    });
  }

  async removeChecklist(id: string, userId: string) {
    await this.assertManagerial(userId);
    const item = await this.prisma.checklistItem.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, taskId: true },
    });
    if (!item) throw new NotFoundException('Checklist item not found.');
    await this.assertTaskVisible(item.taskId, userId);

    return this.prisma.checklistItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async replaceTags(
    taskId: string,
    userId: string,
    dto: ReplaceTaskTagsDto,
  ) {
    await this.assertManagerial(userId);
    await this.assertTaskVisible(taskId, userId);
    const names = this.normalizeTagNames(dto.names);

    await this.prisma.$transaction(async (tx) => {
      await tx.taskTag.deleteMany({ where: { taskId } });

      for (const name of names) {
        const tag = await tx.tag.upsert({
          where: { name },
          update: {},
          create: { name },
          select: { id: true },
        });

        await tx.taskTag.create({
          data: { taskId, tagId: tag.id },
        });
      }
    });

    return this.structure(taskId, userId);
  }

  async replaceDependencies(
    taskId: string,
    userId: string,
    dto: ReplaceTaskDependenciesDto,
  ) {
    await this.assertManagerial(userId);
    await this.assertTaskVisible(taskId, userId);
    const ids = await this.validateDependencies(
      taskId,
      dto.taskIds,
      userId,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.taskDependency.deleteMany({ where: { taskId } });

      if (ids.length) {
        await tx.taskDependency.createMany({
          data: ids.map((dependsOnTaskId) => ({
            taskId,
            dependsOnTaskId,
            type: dto.type ?? 'FINISH_TO_START',
          })),
        });
      }
    });

    return this.structure(taskId, userId);
  }
}
