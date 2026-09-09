import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { NotificationKind, RecurrenceFrequency } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRecurringTaskDto,
  UpdateRecurringTaskDto,
} from './dto/recurring-task.dto';
import { NotificationsService } from './notifications.service';

@Injectable()
export class RecurringTasksService implements OnModuleInit, OnModuleDestroy {
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private initialTimer: ReturnType<typeof setTimeout> | null = null;
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    const configured = Number(process.env.RECURRING_TASK_SCAN_MINUTES ?? 1);
    const minutes = Number.isFinite(configured) && configured >= 1 ? configured : 1;

    this.initialTimer = setTimeout(() => {
      void this.processDueRules().catch((error) => {
        console.error('[RecurringTasks] initial scan failed:', error);
      });
    }, 12000);

    this.intervalTimer = setInterval(() => {
      void this.processDueRules().catch((error) => {
        console.error('[RecurringTasks] scan failed:', error);
      });
    }, minutes * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.initialTimer) clearTimeout(this.initialTimer);
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    this.initialTimer = null;
    this.intervalTimer = null;
  }

  private parseDate(value: string, label: string) {
    const result = new Date(value);
    if (Number.isNaN(result.getTime())) {
      throw new BadRequestException(`${label} is invalid.`);
    }
    return result;
  }

  private async identity(userId: string) {
    const [roles, employee] = await Promise.all([
      this.prisma.userRole.findMany({
        where: { userId },
        select: { role: { select: { name: true } } },
      }),
      this.prisma.employeeProfile.findFirst({
        where: { userId, deletedAt: null },
        select: { id: true },
      }),
    ]);

    return {
      roles: roles.map((item) => item.role.name),
      employeeId: employee?.id ?? null,
    };
  }

  private async manageableTaskWhere(userId: string): Promise<any> {
    const identity = await this.identity(userId);

    if (
      identity.roles.includes('SUPER_ADMIN') ||
      identity.roles.includes('ADMIN')
    ) {
      return { deletedAt: null };
    }

    if (!identity.employeeId) return { id: '__NO_ACCESS__' };

    if (identity.roles.includes('MANAGER')) {
      return {
        deletedAt: null,
        OR: [
          { createdById: userId },
          { project: { projectManagerId: identity.employeeId } },
          { reviewers: { some: { employeeId: identity.employeeId } } },
        ],
      };
    }

    return { id: '__NO_ACCESS__' };
  }

  private async assertCanManage(userId: string, taskId: string) {
    const where = await this.manageableTaskWhere(userId);
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, ...where },
      select: { id: true },
    });

    if (!task) {
      throw new ForbiddenException('You cannot manage recurrence for this task.');
    }
  }

  async templateOptions(userId: string) {
    const where = await this.manageableTaskWhere(userId);

    return this.prisma.task.findMany({
      where: {
        ...where,
        isDraft: false,
        recurringTemplate: null,
      },
      select: {
        id: true,
        title: true,
        priority: true,
        project: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        assignees: {
          where: { removedAt: null },
          select: {
            employee: { select: { id: true, fullName: true, username: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  private weekdays(values: number[]) {
    return [...new Set(values)].sort((a, b) => a - b);
  }

  private nextDaily(after: Date, interval: number) {
    const next = new Date(after);
    next.setUTCDate(next.getUTCDate() + interval);
    return next;
  }

  private nextWeekly(
    after: Date,
    interval: number,
    weekdays: number[],
    startAt: Date,
  ) {
    const allowed = weekdays.length ? this.weekdays(weekdays) : [startAt.getUTCDay()];

    for (let offset = 1; offset <= 7 * interval + 7; offset += 1) {
      const candidate = new Date(after);
      candidate.setUTCDate(candidate.getUTCDate() + offset);
      if (!allowed.includes(candidate.getUTCDay())) continue;

      const startDay = Date.UTC(
        startAt.getUTCFullYear(),
        startAt.getUTCMonth(),
        startAt.getUTCDate(),
      );
      const candidateDay = Date.UTC(
        candidate.getUTCFullYear(),
        candidate.getUTCMonth(),
        candidate.getUTCDate(),
      );
      const weeks = Math.floor(
        (candidateDay - startDay) / (7 * 24 * 60 * 60 * 1000),
      );

      if (weeks >= 0 && weeks % interval === 0) return candidate;
    }

    return this.nextDaily(after, 7 * interval);
  }

  private nextMonthly(
    after: Date,
    interval: number,
    dayOfMonth: number | null,
    startAt: Date,
  ) {
    const desiredDay = dayOfMonth ?? startAt.getUTCDate();
    const next = new Date(after);
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + interval);

    const lastDay = new Date(
      Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
    ).getUTCDate();

    next.setUTCDate(Math.min(desiredDay, lastDay));
    return next;
  }

  private nextYearly(after: Date, interval: number, startAt: Date) {
    const year = after.getUTCFullYear() + interval;
    const month = startAt.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    return new Date(
      Date.UTC(
        year,
        month,
        Math.min(startAt.getUTCDate(), lastDay),
        startAt.getUTCHours(),
        startAt.getUTCMinutes(),
        startAt.getUTCSeconds(),
        startAt.getUTCMilliseconds(),
      ),
    );
  }

  private nextRun(
    frequency: RecurrenceFrequency,
    after: Date,
    interval: number,
    weekdays: number[],
    dayOfMonth: number | null,
    startAt: Date,
  ) {
    switch (frequency) {
      case RecurrenceFrequency.DAILY:
        return this.nextDaily(after, interval);
      case RecurrenceFrequency.WEEKLY:
        return this.nextWeekly(after, interval, weekdays, startAt);
      case RecurrenceFrequency.MONTHLY:
        return this.nextMonthly(after, interval, dayOfMonth, startAt);
      case RecurrenceFrequency.YEARLY:
        return this.nextYearly(after, interval, startAt);
      case RecurrenceFrequency.CUSTOM:
      default:
        return this.nextDaily(after, interval);
    }
  }

  private firstRun(
    frequency: RecurrenceFrequency,
    interval: number,
    weekdays: number[],
    dayOfMonth: number | null,
    startAt: Date,
  ) {
    const now = new Date();
    let candidate = new Date(startAt);

    if (
      frequency === RecurrenceFrequency.WEEKLY &&
      weekdays.length &&
      !weekdays.includes(candidate.getUTCDay())
    ) {
      candidate = this.nextWeekly(candidate, interval, weekdays, startAt);
    }

    if (frequency === RecurrenceFrequency.MONTHLY && dayOfMonth) {
      const lastDay = new Date(
        Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, 0),
      ).getUTCDate();
      candidate.setUTCDate(Math.min(dayOfMonth, lastDay));
    }

    let safety = 0;
    while (candidate < now && safety < 10000) {
      candidate = this.nextRun(
        frequency,
        candidate,
        interval,
        weekdays,
        dayOfMonth,
        startAt,
      );
      safety += 1;
    }

    return candidate;
  }

  async create(userId: string, dto: CreateRecurringTaskDto) {
    await this.assertCanManage(userId, dto.templateTaskId);

    const template = await this.prisma.task.findFirst({
      where: { id: dto.templateTaskId, deletedAt: null },
      select: { id: true, recurringTemplate: { select: { id: true, deletedAt: true } } },
    });

    if (!template) throw new NotFoundException('Template task not found.');
    if (template.recurringTemplate && !template.recurringTemplate.deletedAt) {
      throw new BadRequestException('This task already has a recurring schedule.');
    }

    const startAt = this.parseDate(dto.startAt, 'Start date');
    const endAt = dto.endAt ? this.parseDate(dto.endAt, 'End date') : null;
    if (endAt && endAt < startAt) {
      throw new BadRequestException('End date must be after start date.');
    }

    const interval = dto.interval ?? 1;
    const weekdays = this.weekdays(dto.weekdays ?? []);
    const dayOfMonth = dto.dayOfMonth ?? null;
    const nextRunAt = this.firstRun(
      dto.frequency,
      interval,
      weekdays,
      dayOfMonth,
      startAt,
    );

    if (endAt && nextRunAt > endAt) {
      throw new BadRequestException('First occurrence is after the end date.');
    }

    const deletedExisting = await this.prisma.recurringTask.findUnique({
      where: { templateTaskId: dto.templateTaskId },
    });

    if (deletedExisting?.deletedAt) {
      return this.prisma.recurringTask.update({
        where: { id: deletedExisting.id },
        data: {
          createdById: userId,
          frequency: dto.frequency,
          interval,
          weekdays,
          dayOfMonth,
          recurrenceRule: dto.recurrenceRule ?? null,
          startAt,
          endAt,
          nextRunAt,
          lastRunAt: null,
          isActive: true,
          deletedAt: null,
        },
        include: { templateTask: { select: { id: true, title: true } } },
      });
    }

    return this.prisma.recurringTask.create({
      data: {
        templateTaskId: dto.templateTaskId,
        createdById: userId,
        frequency: dto.frequency,
        interval,
        weekdays,
        dayOfMonth,
        recurrenceRule: dto.recurrenceRule ?? null,
        startAt,
        endAt,
        nextRunAt,
      },
      include: { templateTask: { select: { id: true, title: true } } },
    });
  }

  async list(userId: string) {
    const where = await this.manageableTaskWhere(userId);

    return this.prisma.recurringTask.findMany({
      where: { deletedAt: null, templateTask: where },
      include: {
        templateTask: {
          select: {
            id: true,
            title: true,
            priority: true,
            dueAt: true,
            client: { select: { id: true, name: true } },
            project: { select: { id: true, name: true } },
            assignees: {
              where: { removedAt: null },
              select: {
                employee: { select: { id: true, fullName: true, username: true } },
              },
            },
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { nextRunAt: 'asc' }],
    });
  }

  async update(userId: string, id: string, dto: UpdateRecurringTaskDto) {
    const current = await this.prisma.recurringTask.findFirst({
      where: { id, deletedAt: null },
    });
    if (!current) throw new NotFoundException('Recurring task not found.');

    await this.assertCanManage(userId, current.templateTaskId);

    const frequency = dto.frequency ?? current.frequency;
    const interval = dto.interval ?? current.interval;
    const weekdays = dto.weekdays ? this.weekdays(dto.weekdays) : current.weekdays;
    const dayOfMonth = dto.dayOfMonth ?? current.dayOfMonth;
    const startAt = dto.startAt
      ? this.parseDate(dto.startAt, 'Start date')
      : current.startAt;
    const endAt =
      dto.endAt === undefined
        ? current.endAt
        : dto.endAt
          ? this.parseDate(dto.endAt, 'End date')
          : null;

    if (endAt && endAt < startAt) {
      throw new BadRequestException('End date must be after start date.');
    }

    const shouldRecalculate =
      dto.frequency !== undefined ||
      dto.interval !== undefined ||
      dto.weekdays !== undefined ||
      dto.dayOfMonth !== undefined ||
      dto.startAt !== undefined ||
      dto.endAt !== undefined ||
      (dto.isActive === true && !current.isActive);

    const nextRunAt = shouldRecalculate
      ? this.firstRun(frequency, interval, weekdays, dayOfMonth, startAt)
      : current.nextRunAt;

    return this.prisma.recurringTask.update({
      where: { id },
      data: {
        frequency,
        interval,
        weekdays,
        dayOfMonth,
        recurrenceRule: dto.recurrenceRule ?? current.recurrenceRule,
        startAt,
        endAt,
        nextRunAt,
        isActive: dto.isActive ?? current.isActive,
      },
      include: { templateTask: { select: { id: true, title: true } } },
    });
  }

  async remove(userId: string, id: string) {
    const current = await this.prisma.recurringTask.findFirst({
      where: { id, deletedAt: null },
    });
    if (!current) throw new NotFoundException('Recurring task not found.');

    await this.assertCanManage(userId, current.templateTaskId);

    return this.prisma.recurringTask.update({
      where: { id },
      data: { isActive: false, nextRunAt: null, deletedAt: new Date() },
    });
  }

  private async generate(recurringId: string, occurrenceAt: Date) {
    const recurring = await this.prisma.recurringTask.findFirst({
      where: { id: recurringId, deletedAt: null, isActive: true },
      include: {
        templateTask: {
          include: {
            assignees: { where: { removedAt: null } },
            collaborators: { where: { removedAt: null } },
            followers: true,
            reviewers: true,
            subtasks: { where: { deletedAt: null } },
            checklist: { where: { deletedAt: null } },
            tags: true,
          },
        },
      },
    });

    if (!recurring) return null;
    if (recurring.endAt && occurrenceAt > recurring.endAt) {
      await this.prisma.recurringTask.update({
        where: { id: recurring.id },
        data: { isActive: false, nextRunAt: null },
      });
      return null;
    }

    const template = recurring.templateTask;
    const todo = await this.prisma.taskStatus.findFirst({
      where: { code: 'TODO', deletedAt: null, isActive: true },
      select: { id: true },
    });

    let dueOffsetMs: number | null = null;
    if (template.dueAt) {
      dueOffsetMs = template.startDate
        ? Math.max(0, template.dueAt.getTime() - template.startDate.getTime())
        : 0;
    }

    const generated = await this.prisma.task.create({
      data: {
        title: template.title,
        description: template.description,
        clientId: template.clientId,
        projectId: template.projectId,
        departmentId: template.departmentId,
        categoryId: template.categoryId,
        statusId: todo?.id ?? template.statusId,
        createdById: recurring.createdById,
        recurringTaskId: recurring.id,
        priority: template.priority,
        startDate: occurrenceAt,
        dueAt:
          dueOffsetMs === null
            ? null
            : new Date(occurrenceAt.getTime() + dueOffsetMs),
        estimatedHours: template.estimatedHours,
        internalNotes: template.internalNotes,
        isDraft: false,
        isCritical: template.isCritical,
        creationSource: template.creationSource,
        assignees: {
          create: template.assignees.map((item) => ({
            employeeId: item.employeeId,
            isPrimary: item.isPrimary,
          })),
        },
        collaborators: {
          create: template.collaborators.map((item) => ({
            employeeId: item.employeeId,
          })),
        },
        followers: {
          create: template.followers.map((item) => ({
            employeeId: item.employeeId,
          })),
        },
        reviewers: {
          create: template.reviewers.map((item) => ({
            employeeId: item.employeeId,
            sortOrder: item.sortOrder,
            isRequired: item.isRequired,
          })),
        },
        subtasks: {
          create: template.subtasks.map((item) => ({
            title: item.title,
            description: item.description,
            assignedEmployeeId: item.assignedEmployeeId,
            sortOrder: item.sortOrder,
          })),
        },
        checklist: {
          create: template.checklist.map((item) => ({
            title: item.title,
            sortOrder: item.sortOrder,
          })),
        },
        tags: {
          create: template.tags.map((item) => ({ tagId: item.tagId })),
        },
      },
      include: {
        assignees: {
          where: { removedAt: null },
          select: { employeeId: true },
        },
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: recurring.createdById,
        action: 'RECURRING_TASK_GENERATED',
        entityType: 'TASK',
        entityId: generated.id,
        metadata: {
          recurringTaskId: recurring.id,
          templateTaskId: template.id,
          occurrenceAt: occurrenceAt.toISOString(),
        },
      },
    });

    await this.notificationsService.notifyEmployees(
      generated.assignees.map((item) => item.employeeId),
      {
        actorId: recurring.createdById,
        kind: generated.isCritical
          ? NotificationKind.TASK_CRITICAL_ASSIGNED
          : NotificationKind.TASK_ASSIGNED,
        title: generated.isCritical
          ? 'Critical recurring task assigned'
          : 'Recurring task assigned',
        message: generated.title,
        entityType: 'TASK',
        entityId: generated.id,
        redirectPath: `/tasks?task=${generated.id}`,
      },
    );

    const next = this.nextRun(
      recurring.frequency,
      occurrenceAt,
      recurring.interval,
      recurring.weekdays,
      recurring.dayOfMonth,
      recurring.startAt,
    );
    const finished = Boolean(recurring.endAt && next > recurring.endAt);

    await this.prisma.recurringTask.update({
      where: { id: recurring.id },
      data: {
        lastRunAt: occurrenceAt,
        nextRunAt: finished ? null : next,
        isActive: finished ? false : true,
      },
    });

    return generated;
  }

  async processDueRules() {
    if (this.processing) return { generated: 0, skipped: true };
    this.processing = true;

    try {
      const now = new Date();
      const rules = await this.prisma.recurringTask.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          nextRunAt: { lte: now },
        },
        select: { id: true, nextRunAt: true },
        orderBy: { nextRunAt: 'asc' },
        take: 100,
      });

      let generated = 0;
      for (const rule of rules) {
        if (!rule.nextRunAt) continue;
        const created = await this.generate(rule.id, rule.nextRunAt);
        if (created) generated += 1;
      }

      return { generated, skipped: false };
    } finally {
      this.processing = false;
    }
  }

  async runNow(userId: string, id: string) {
    const current = await this.prisma.recurringTask.findFirst({
      where: { id, deletedAt: null },
    });
    if (!current) throw new NotFoundException('Recurring task not found.');

    await this.assertCanManage(userId, current.templateTaskId);
    const created = await this.generate(id, new Date());
    if (!created) {
      throw new BadRequestException('This recurring schedule is inactive or expired.');
    }
    return created;
  }
}
