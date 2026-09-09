import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectStatus, TimeEntryStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ManualTimeEntryDto, StartTimeEntryDto } from './dto/time-entry.dto';

type TimeQuery = {
  start?: string;
  end?: string;
  employeeId?: string;
  projectId?: string;
  taskId?: string;
};

@Injectable()
export class TimeEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  private async markProjectActive(
    projectId: string,
  ) {
    await this.prisma.project.updateMany({
      where: {
        id: projectId,
        deletedAt: null,
        status: {
          in: [
            ProjectStatus.PLANNING,
            ProjectStatus.UNDER_REVIEW,
          ],
        },
      },
      data: {
        status:
          ProjectStatus.ACTIVE,
      },
    });
  }

  private async identity(userId: string) {
    const [roles, employee] = await Promise.all([
      this.prisma.userRole.findMany({
        where: {
          userId,
          role: { isActive: true },
        },
        select: { role: { select: { name: true } } },
      }),
      this.prisma.employeeProfile.findFirst({
        where: { userId, deletedAt: null },
        select: { id: true, fullName: true },
      }),
    ]);

    return {
      roles: roles.map((item) => item.role.name),
      employee,
    };
  }

  private async ownEmployee(userId: string) {
    const { employee } = await this.identity(userId);
    if (!employee) {
      throw new ForbiddenException(
        'This account does not have an employee profile for time tracking.',
      );
    }
    return employee;
  }

  private async allowedEmployeeIds(userId: string): Promise<string[] | null> {
    const { roles, employee } = await this.identity(userId);

    if (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN')) return null;
    if (!employee) return [];

    if (roles.includes('MANAGER')) {
      const reports = await this.prisma.employeeProfile.findMany({
        where: { reportingManagerId: employee.id, deletedAt: null },
        select: { id: true },
      });
      return [employee.id, ...reports.map((item) => item.id)];
    }

    return [employee.id];
  }

  private async assertTaskVisible(userId: string, taskId: string) {
    const { roles, employee } = await this.identity(userId);

    if (roles.includes('SUPER_ADMIN') || roles.includes('ADMIN')) {
      const exists = await this.prisma.task.findFirst({
        where: { id: taskId, deletedAt: null },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Task not found.');
      return;
    }

    if (!employee) throw new NotFoundException('Task not found.');

    const reports = roles.includes('MANAGER')
      ? await this.prisma.employeeProfile.findMany({
          where: { reportingManagerId: employee.id, deletedAt: null },
          select: { id: true },
        })
      : [];

    const teamIds = [employee.id, ...reports.map((item) => item.id)];
    const where: any = {
      id: taskId,
      deletedAt: null,
      OR: roles.includes('MANAGER')
        ? [
            { project: { projectManagerId: employee.id } },
            { assignees: { some: { employeeId: { in: teamIds }, removedAt: null } } },
            { collaborators: { some: { employeeId: { in: teamIds }, removedAt: null } } },
            { reviewers: { some: { employeeId: employee.id } } },
          ]
        : [
            { assignees: { some: { employeeId: employee.id, removedAt: null } } },
            { collaborators: { some: { employeeId: employee.id, removedAt: null } } },
          ],
    };

    const visible = await this.prisma.task.findFirst({ where, select: { id: true } });
    if (!visible) throw new NotFoundException('Task not found.');
  }

  private parseDate(value: string | undefined, fallback: Date) {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date.');
    return date;
  }

  private include() {
    return {
      employee: {
        select: {
          id: true,
          employeeId: true,
          fullName: true,
          username: true,
          designation: true,
          department: { select: { id: true, name: true } },
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          estimatedHours: true,
          client: { select: { id: true, name: true } },
        },
      },
      task: {
        select: {
          id: true,
          title: true,
          estimatedHours: true,
          priority: true,
          status: { select: { code: true, name: true } },
        },
      },
    } as const;
  }

  private effectiveSeconds(entry: any) {
    let seconds = entry.durationSeconds ?? 0;
    if (entry.status === TimeEntryStatus.RUNNING && entry.activeStartedAt) {
      seconds += Math.max(
        0,
        Math.floor((Date.now() - new Date(entry.activeStartedAt).getTime()) / 1000),
      );
    }
    return seconds;
  }

  private serialize(entry: any) {
    return { ...entry, effectiveDurationSeconds: this.effectiveSeconds(entry) };
  }

  private async assertTrackable(
    userId: string,
    employeeId: string,
    projectId: string,
    taskId?: string,
    allowClosedTask = false,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found.');

    const { roles } = await this.identity(userId);
    const privileged = roles.includes('SUPER_ADMIN') || roles.includes('ADMIN');

    if (taskId) {
      const task = await this.prisma.task.findFirst({
        where: { id: taskId, projectId, deletedAt: null },
        select: {
          id: true,
          status: { select: { code: true } },
          project: { select: { projectManagerId: true } },
          assignees: {
            where: { employeeId, removedAt: null },
            select: { id: true },
          },
          collaborators: {
            where: { employeeId, removedAt: null },
            select: { id: true },
          },
          reviewers: {
            where: { employeeId },
            select: { id: true },
          },
        },
      });

      if (!task) throw new NotFoundException('Task not found in selected project.');

      if (
        !allowClosedTask &&
        ['DONE', 'COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(task.status.code)
      ) {
        throw new BadRequestException('Time tracking is closed for this task.');
      }

      const visible =
        task.assignees.length > 0 ||
        task.collaborators.length > 0 ||
        task.reviewers.length > 0 ||
        task.project.projectManagerId === employeeId;

      if (!privileged && !visible) {
        throw new ForbiddenException('You cannot track time for this task.');
      }
      return;
    }

    if (!privileged) {
      const visible = await this.prisma.project.findFirst({
        where: {
          id: projectId,
          deletedAt: null,
          OR: [
            { projectManagerId: employeeId },
            {
              members: {
                some: { employeeId, isActive: true, leftAt: null },
              },
            },
            {
              tasks: {
                some: {
                  deletedAt: null,
                  OR: [
                    {
                      assignees: {
                        some: { employeeId, removedAt: null },
                      },
                    },
                    {
                      collaborators: {
                        some: { employeeId, removedAt: null },
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
        select: { id: true },
      });

      if (!visible) throw new ForbiddenException('You cannot track time for this project.');
    }
  }

  async getOptions(userId: string) {
    const { roles, employee } = await this.identity(userId);
    if (!employee) return { projects: [], tasks: [], employees: [] };

    const privileged = roles.includes('SUPER_ADMIN') || roles.includes('ADMIN');
    const manager = roles.includes('MANAGER');
    const projectWhere: any = { deletedAt: null };
    const taskWhere: any = { deletedAt: null, isDraft: false };

    if (!privileged) {
      const reports = manager
        ? await this.prisma.employeeProfile.findMany({
            where: { reportingManagerId: employee.id, deletedAt: null },
            select: { id: true },
          })
        : [];
      const teamIds = [employee.id, ...reports.map((item) => item.id)];

      projectWhere.OR = [
        { projectManagerId: employee.id },
        {
          members: {
            some: {
              employeeId: { in: teamIds },
              isActive: true,
              leftAt: null,
            },
          },
        },
        {
          tasks: {
            some: {
              deletedAt: null,
              OR: [
                {
                  assignees: {
                    some: { employeeId: { in: teamIds }, removedAt: null },
                  },
                },
                {
                  collaborators: {
                    some: { employeeId: { in: teamIds }, removedAt: null },
                  },
                },
              ],
            },
          },
        },
      ];

      taskWhere.OR = manager
        ? [
            { project: { projectManagerId: employee.id } },
            {
              assignees: {
                some: { employeeId: { in: teamIds }, removedAt: null },
              },
            },
            {
              collaborators: {
                some: { employeeId: { in: teamIds }, removedAt: null },
              },
            },
            { reviewers: { some: { employeeId: employee.id } } },
          ]
        : [
            { assignees: { some: { employeeId: employee.id, removedAt: null } } },
            {
              collaborators: {
                some: { employeeId: employee.id, removedAt: null },
              },
            },
          ];
    }

    const allowed = await this.allowedEmployeeIds(userId);

    const [projects, tasks, employees] = await Promise.all([
      this.prisma.project.findMany({
        where: projectWhere,
        select: {
          id: true,
          name: true,
          client: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.task.findMany({
        where: taskWhere,
        select: {
          id: true,
          title: true,
          projectId: true,
          estimatedHours: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: { title: 'asc' },
        take: 500,
      }),
      this.prisma.employeeProfile.findMany({
        where: {
          deletedAt: null,
          ...(allowed === null ? {} : { id: { in: allowed } }),
        },
        select: {
          id: true,
          fullName: true,
          username: true,
          designation: true,
        },
        orderBy: { fullName: 'asc' },
      }),
    ]);

    return { projects, tasks, employees };
  }

  async getCurrent(userId: string) {
    const employee = await this.ownEmployee(userId);
    const entry = await this.prisma.timeEntry.findFirst({
      where: {
        employeeId: employee.id,
        deletedAt: null,
        status: { in: [TimeEntryStatus.RUNNING, TimeEntryStatus.PAUSED] },
      },
      include: this.include(),
      orderBy: { createdAt: 'desc' },
    });
    return entry ? this.serialize(entry) : null;
  }

  async start(userId: string, dto: StartTimeEntryDto) {
    const employee = await this.ownEmployee(userId);
    const existing = await this.prisma.timeEntry.findFirst({
      where: {
        employeeId: employee.id,
        deletedAt: null,
        status: { in: [TimeEntryStatus.RUNNING, TimeEntryStatus.PAUSED] },
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        'You already have an active or paused timer. Stop it before starting another.',
      );
    }

    await this.assertTrackable(userId, employee.id, dto.projectId, dto.taskId);
    const now = new Date();
    const entry = await this.prisma.timeEntry.create({
      data: {
        employeeId: employee.id,
        projectId: dto.projectId,
        taskId: dto.taskId ?? null,
        status: TimeEntryStatus.RUNNING,
        workDate: now,
        startedAt: now,
        activeStartedAt: now,
        notes: dto.notes?.trim() || null,
      },
      include: this.include(),
    });

    await this.markProjectActive(
      entry.projectId,
    );

    await this.log(userId, 'TIME_ENTRY_STARTED', entry.id, {
      projectId: entry.projectId,
      taskId: entry.taskId,
    });

    return this.serialize(entry);
  }

  private async ownEntry(userId: string, id: string) {
    const employee = await this.ownEmployee(userId);
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id, employeeId: employee.id, deletedAt: null },
    });
    if (!entry) throw new NotFoundException('Time entry not found.');
    return entry;
  }

  async pause(userId: string, id: string) {
    const entry = await this.ownEntry(userId, id);
    if (entry.status !== TimeEntryStatus.RUNNING) {
      throw new BadRequestException('Only a running timer can be paused.');
    }
    const now = new Date();
    const added = entry.activeStartedAt
      ? Math.max(0, Math.floor((now.getTime() - entry.activeStartedAt.getTime()) / 1000))
      : 0;

    const updated = await this.prisma.timeEntry.update({
      where: { id },
      data: {
        status: TimeEntryStatus.PAUSED,
        durationSeconds: entry.durationSeconds + added,
        activeStartedAt: null,
      },
      include: this.include(),
    });
    await this.log(userId, 'TIME_ENTRY_PAUSED', id);
    return this.serialize(updated);
  }

  async resume(userId: string, id: string) {
    const entry = await this.ownEntry(userId, id);
    if (entry.status !== TimeEntryStatus.PAUSED) {
      throw new BadRequestException('Only a paused timer can be resumed.');
    }
    const other = await this.prisma.timeEntry.findFirst({
      where: {
        employeeId: entry.employeeId,
        deletedAt: null,
        id: { not: id },
        status: TimeEntryStatus.RUNNING,
      },
      select: { id: true },
    });
    if (other) throw new BadRequestException('Another timer is already running.');

    const updated = await this.prisma.timeEntry.update({
      where: { id },
      data: { status: TimeEntryStatus.RUNNING, activeStartedAt: new Date() },
      include: this.include(),
    });
    await this.markProjectActive(
      updated.projectId,
    );

    await this.log(userId, 'TIME_ENTRY_RESUMED', id);
    return this.serialize(updated);
  }

  async stop(userId: string, id: string) {
    const entry = await this.ownEntry(userId, id);
    if (entry.status === TimeEntryStatus.STOPPED) {
      throw new BadRequestException('Timer is already stopped.');
    }
    const now = new Date();
    const added =
      entry.status === TimeEntryStatus.RUNNING && entry.activeStartedAt
        ? Math.max(0, Math.floor((now.getTime() - entry.activeStartedAt.getTime()) / 1000))
        : 0;

    const updated = await this.prisma.timeEntry.update({
      where: { id },
      data: {
        status: TimeEntryStatus.STOPPED,
        durationSeconds: entry.durationSeconds + added,
        activeStartedAt: null,
        endedAt: now,
      },
      include: this.include(),
    });
    await this.log(userId, 'TIME_ENTRY_STOPPED', id, {
      durationSeconds: updated.durationSeconds,
    });
    return this.serialize(updated);
  }

  async manual(userId: string, dto: ManualTimeEntryDto) {
    const employee = await this.ownEmployee(userId);
    await this.assertTrackable(
      userId,
      employee.id,
      dto.projectId,
      dto.taskId,
      true,
    );

    const workDate = this.parseDate(dto.workDate, new Date());
    const durationSeconds = dto.durationMinutes * 60;
    const entry = await this.prisma.timeEntry.create({
      data: {
        employeeId: employee.id,
        projectId: dto.projectId,
        taskId: dto.taskId ?? null,
        status: TimeEntryStatus.STOPPED,
        workDate,
        startedAt: workDate,
        endedAt: new Date(workDate.getTime() + durationSeconds * 1000),
        durationSeconds,
        isManual: true,
        notes: dto.notes?.trim() || null,
      },
      include: this.include(),
    });
    await this.log(userId, 'TIME_ENTRY_MANUAL_CREATED', entry.id, {
      projectId: entry.projectId,
      taskId: entry.taskId,
      durationSeconds,
    });
    return this.serialize(entry);
  }

  private async buildWhere(userId: string, query: TimeQuery) {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const start = this.parseDate(query.start, defaultStart);
    const end = this.parseDate(query.end, defaultEnd);
    if (end <= start) throw new BadRequestException('End date must be after start date.');
    if (end.getTime() - start.getTime() > 366 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException('Time report range cannot exceed 366 days.');
    }

    if (query.taskId) {
      await this.assertTaskVisible(userId, query.taskId);
    }

    const allowed = await this.allowedEmployeeIds(userId);
    if (query.employeeId && allowed !== null && !allowed.includes(query.employeeId)) {
      throw new ForbiddenException('You cannot view this employee time log.');
    }

    const where: any = {
      deletedAt: null,
      workDate: { gte: start, lt: end },
    };

    if (query.employeeId) where.employeeId = query.employeeId;
    else if (allowed !== null) where.employeeId = { in: allowed };
    if (query.projectId) where.projectId = query.projectId;
    if (query.taskId) where.taskId = query.taskId;

    return { where, start, end };
  }

  async list(userId: string, query: TimeQuery) {
    const { where, start, end } = await this.buildWhere(userId, query);
    const entries = await this.prisma.timeEntry.findMany({
      where,
      include: this.include(),
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
      take: 1000,
    });
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      entries: entries.map((entry) => this.serialize(entry)),
    };
  }

  async getSummary(userId: string, query: TimeQuery) {
    const { where, start, end } = await this.buildWhere(userId, query);
    const entries = await this.prisma.timeEntry.findMany({
      where,
      include: this.include(),
      orderBy: { workDate: 'asc' },
      take: 5000,
    });
    const rows = entries.map((entry) => this.serialize(entry));
    const totalSeconds = rows.reduce((sum, row) => sum + row.effectiveDurationSeconds, 0);
    const manualSeconds = rows
      .filter((row) => row.isManual)
      .reduce((sum, row) => sum + row.effectiveDurationSeconds, 0);

    const byProject = new Map<string, any>();
    const byEmployee = new Map<string, any>();
    const byDay = new Map<string, number>();
    const taskMap = new Map<string, any>();

    for (const row of rows) {
      const seconds = row.effectiveDurationSeconds;
      const project = byProject.get(row.project.id) ?? {
        projectId: row.project.id,
        projectName: row.project.name,
        clientName: row.project.client.name,
        seconds: 0,
        entries: 0,
      };
      project.seconds += seconds;
      project.entries += 1;
      byProject.set(row.project.id, project);

      const employee = byEmployee.get(row.employee.id) ?? {
        employeeId: row.employee.id,
        employeeName: row.employee.fullName,
        seconds: 0,
        entries: 0,
      };
      employee.seconds += seconds;
      employee.entries += 1;
      byEmployee.set(row.employee.id, employee);

      const day = row.workDate.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + seconds);

      if (row.task) {
        const task = taskMap.get(row.task.id) ?? {
          taskId: row.task.id,
          title: row.task.title,
          estimatedHours: row.task.estimatedHours ? Number(row.task.estimatedHours) : 0,
          actualSeconds: 0,
        };
        task.actualSeconds += seconds;
        taskMap.set(row.task.id, task);
      }
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
      totals: {
        totalSeconds,
        timerSeconds: totalSeconds - manualSeconds,
        manualSeconds,
        entryCount: rows.length,
        runningCount: rows.filter((row) => row.status === TimeEntryStatus.RUNNING).length,
      },
      byProject: [...byProject.values()].sort((a, b) => b.seconds - a.seconds),
      byEmployee: [...byEmployee.values()].sort((a, b) => b.seconds - a.seconds),
      byDay: [...byDay.entries()].map(([date, seconds]) => ({ date, seconds })),
      estimatedVsActual: [...taskMap.values()].sort(
        (a, b) => b.actualSeconds - a.actualSeconds,
      ),
    };
  }

  private log(userId: string, action: string, entityId: string, metadata?: any) {
    return this.prisma.activityLog.create({
      data: {
        userId,
        action,
        entityType: 'TIME_ENTRY',
        entityId,
        metadata: metadata ?? undefined,
      },
    });
  }
}
