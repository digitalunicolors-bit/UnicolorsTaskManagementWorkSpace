import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { NotificationKind } from '../generated/prisma/enums';
import { WhatsappService } from './whatsapp.service';

type PreferenceKey =
  | 'taskAssigned'
  | 'taskReassigned'
  | 'dueReminder'
  | 'upcomingDeadline'
  | 'overdueTask'
  | 'commentAdded'
  | 'userMentioned'
  | 'fileUploaded'
  | 'reviewUpdates'
  | 'taskCompleted'
  | 'projectDeadline'
  | 'dailyDigestEnabled';

export interface CreateNotificationPayload {
  actorId?: string | null;
  kind: NotificationKind;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  redirectPath?: string | null;
}

interface SchedulerStats {
  dueToday: number;
  upcoming: number;
  overdue: number;
  projectDeadline: number;
  dailyDigest: number;
}

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private initialTimer: ReturnType<typeof setTimeout> | null = null;
  private schedulerRunning = false;

  private readonly closedTaskStatuses = new Set([
    'DONE',
    'COMPLETED',
    'CANCELLED',
    'ARCHIVED',
  ]);

  private readonly closedProjectStatuses = new Set([
    'COMPLETED',
    'CANCELLED',
    'ARCHIVED',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
  ) {}

  onModuleInit() {
    this.initialTimer = setTimeout(() => {
      void this.runScheduledNotifications().catch((error) => {
        console.error('[Notifications] Initial reminder scan failed:', error);
      });
    }, 8000);

    const intervalMinutes = this.getPositiveNumber(
      process.env.NOTIFICATION_SCAN_INTERVAL_MINUTES,
      10,
    );

    this.schedulerTimer = setInterval(() => {
      void this.runScheduledNotifications().catch((error) => {
        console.error('[Notifications] Reminder scan failed:', error);
      });
    }, intervalMinutes * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.initialTimer) {
      clearTimeout(this.initialTimer);
      this.initialTimer = null;
    }

    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private getPositiveNumber(value: string | undefined, fallback: number) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return parsed;
  }

  private timezoneOffsetMinutes() {
    return Math.round(
      this.getPositiveNumber(process.env.APP_TIMEZONE_OFFSET_MINUTES, 330),
    );
  }

  private getLocalClock(now = new Date()) {
    return new Date(now.getTime() + this.timezoneOffsetMinutes() * 60 * 1000);
  }

  private getLocalDayBounds(now = new Date()) {
    const offsetMs = this.timezoneOffsetMinutes() * 60 * 1000;
    const shifted = this.getLocalClock(now);
    const shiftedStart = Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    );

    const start = new Date(shiftedStart - offsetMs);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    return {
      start,
      end,
      localHour: shifted.getUTCHours(),
    };
  }

  private preferenceForKind(kind: NotificationKind): PreferenceKey | null {
    switch (kind) {
      case NotificationKind.TASK_ASSIGNED:
      case NotificationKind.TASK_CRITICAL_ASSIGNED:
        return 'taskAssigned';
      case NotificationKind.TASK_REASSIGNED:
        return 'taskReassigned';
      case NotificationKind.TASK_DUE_REMINDER:
      case NotificationKind.TASK_BEFORE_DUE:
      case NotificationKind.TASK_CUSTOM_REMINDER:
        return 'dueReminder';
      case NotificationKind.TASK_UPCOMING_DEADLINE:
        return 'upcomingDeadline';
      case NotificationKind.TASK_OVERDUE:
        return 'overdueTask';
      case NotificationKind.COMMENT_ADDED:
        return 'commentAdded';
      case NotificationKind.USER_MENTIONED:
        return 'userMentioned';
      case NotificationKind.FILE_UPLOADED:
        return 'fileUploaded';
      case NotificationKind.TASK_SUBMITTED_FOR_REVIEW:
      case NotificationKind.TASK_APPROVED:
      case NotificationKind.TASK_CHANGES_REQUESTED:
        return 'reviewUpdates';
      case NotificationKind.TASK_COMPLETED:
        return 'taskCompleted';
      case NotificationKind.PROJECT_DEADLINE_APPROACHING:
        return 'projectDeadline';
      case NotificationKind.TASK_DAILY_DIGEST:
        return 'dailyDigestEnabled';
      default:
        return null;
    }
  }

  private preferenceValue(preference: any, key: PreferenceKey) {
    switch (key) {
      case 'taskAssigned':
        return preference.taskAssigned;
      case 'taskReassigned':
        return preference.taskReassigned;
      case 'dueReminder':
        return preference.dueReminder;
      case 'upcomingDeadline':
        return preference.upcomingDeadline;
      case 'overdueTask':
        return preference.overdueTask;
      case 'commentAdded':
        return preference.commentAdded;
      case 'userMentioned':
        return preference.userMentioned;
      case 'fileUploaded':
        return preference.fileUploaded;
      case 'reviewUpdates':
        return preference.reviewUpdates;
      case 'taskCompleted':
        return preference.taskCompleted;
      case 'projectDeadline':
        return preference.projectDeadline;
      case 'dailyDigestEnabled':
        return preference.dailyDigestEnabled;
    }
  }

  private async isAllowed(userId: string, kind: NotificationKind) {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!preference) {
      return true;
    }

    if (preference.inAppEnabled === false) {
      return false;
    }

    const key = this.preferenceForKind(kind);

    if (!key) {
      return true;
    }

    return this.preferenceValue(preference, key) !== false;
  }

  private async existingToday(
    userId: string,
    kind: NotificationKind,
    entityId: string | null | undefined,
    dayStart: Date,
  ) {
    return this.prisma.notification.findFirst({
      where: {
        userId,
        kind,
        entityId: entityId ?? null,
        createdAt: { gte: dayStart },
      },
      select: { id: true },
    });
  }

  async notifyUsers(userIds: string[], payload: CreateNotificationPayload) {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

    if (!uniqueUserIds.length) {
      return { created: 0 };
    }

    const validUsers = await this.prisma.user.findMany({
      where: {
        id: { in: uniqueUserIds },
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        notificationPreference: true,
      },
    });

    const preferenceKey = this.preferenceForKind(payload.kind);

    const allowed = validUsers.filter((user) => {
      const preference = user.notificationPreference;

      if (!preference) {
        return true;
      }

      if (preference.inAppEnabled === false) {
        return false;
      }

      if (!preferenceKey) {
        return true;
      }

      return this.preferenceValue(preference, preferenceKey) !== false;
    });

    if (!allowed.length) {
      return { created: 0 };
    }

    const result = await this.prisma.notification.createMany({
      data: allowed.map((user) => ({
        userId: user.id,
        actorId: payload.actorId ?? null,
        kind: payload.kind,
        title: payload.title,
        message: payload.message,
        entityType: payload.entityType ?? null,
        entityId: payload.entityId ?? null,
        redirectPath: payload.redirectPath ?? null,
      })),
    });

    return { created: result.count };
  }

  async notifyEmployees(
    employeeIds: string[],
    payload: CreateNotificationPayload,
  ) {
    const uniqueIds = [...new Set(employeeIds.filter(Boolean))];

    if (!uniqueIds.length) {
      return { created: 0 };
    }

    const employees = await this.prisma.employeeProfile.findMany({
      where: {
        id: { in: uniqueIds },
        deletedAt: null,
        user: {
          isActive: true,
          deletedAt: null,
        },
      },
      select: { userId: true },
    });

    return this.notifyUsers(
      employees.map((employee) => employee.userId),
      payload,
    );
  }

  async notifyTaskAssignees(
    taskId: string,
    actorId: string | null,
    kind: NotificationKind,
    title: string,
    message: string,
  ) {
    const assignees = await this.prisma.taskAssignee.findMany({
      where: {
        taskId,
        removedAt: null,
        employee: {
          deletedAt: null,
          user: {
            isActive: true,
            deletedAt: null,
          },
        },
      },
      select: {
        employee: {
          select: { userId: true },
        },
      },
    });

    return this.notifyUsers(
      assignees.map((item) => item.employee.userId),
      {
        actorId,
        kind,
        title,
        message,
        entityType: 'TASK',
        entityId: taskId,
        redirectPath: `/tasks?task=${taskId}`,
      },
    );
  }

  async notifyTaskReviewers(
    taskId: string,
    actorId: string | null,
    kind: NotificationKind,
    title: string,
    message: string,
  ) {
    const [reviewers, task, superAdminRoles] = await Promise.all([
      this.prisma.taskReviewer.findMany({
        where: {
          taskId,
          employee: {
            deletedAt: null,
            user: {
              isActive: true,
              deletedAt: null,
            },
          },
        },
        select: {
          employee: {
            select: { userId: true },
          },
        },
      }),
      this.prisma.task.findUnique({
        where: { id: taskId },
        select: {
          departmentId: true,
          project: {
            select: {
              departmentId: true,
              projectDepartments: {
                select: { departmentId: true },
              },
            },
          },
        },
      }),
      this.prisma.userRole.findMany({
        where: {
          role: {
            name: 'SUPER_ADMIN',
            isActive: true,
          },
        },
        select: { userId: true },
      }),
    ]);

    const departmentIds = new Set<string>();

    if (task?.departmentId) {
      departmentIds.add(task.departmentId);
    }

    if (task?.project?.departmentId) {
      departmentIds.add(task.project.departmentId);
    }

    task?.project?.projectDepartments.forEach((item) => {
      if (item.departmentId) {
        departmentIds.add(item.departmentId);
      }
    });

    const departments = departmentIds.size
      ? await this.prisma.department.findMany({
          where: {
            id: { in: [...departmentIds] },
            deletedAt: null,
          },
          select: { headId: true },
        })
      : [];

    const headIds = departments
      .map((item) => item.headId)
      .filter((value): value is string => Boolean(value));

    const heads = headIds.length
      ? await this.prisma.employeeProfile.findMany({
          where: {
            id: { in: headIds },
            deletedAt: null,
          },
          select: { userId: true },
        })
      : [];

    return this.notifyUsers(
      [
        ...reviewers.map((item) => item.employee.userId),
        ...heads.map((item) => item.userId),
        ...superAdminRoles.map((item) => item.userId),
      ],
      {
        actorId,
        kind,
        title,
        message,
        entityType: 'TASK',
        entityId: taskId,
        redirectPath: `/tasks?mine=1&task=${taskId}`,
      },
    );
  }

  async findAll(userId: string, limit = 50, unreadOnly = false) {
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));

    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            phone: true,
            employeeProfile: {
              select: {
                fullName: true,
                username: true,
                profileImageUrl: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return { count };
  }

  async markRead(userId: string, notificationId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true, isRead: true },
    });

    if (!existing) {
      throw new NotFoundException('Notification not found.');
    }

    if (existing.isRead) {
      return this.prisma.notification.findUnique({
        where: { id: notificationId },
      });
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      success: true,
      updated: result.count,
    };
  }

  async getPreferences(userId: string) {
    const [preference, user] = await Promise.all([
      this.prisma.notificationPreference.upsert({
        where: { userId },
        create: { userId },
        update: {},
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { whatsappOptInAt: true },
      }),
    ]);

    return {
      ...preference,
      whatsappEnabled:
        preference.whatsappEnabled && Boolean(user?.whatsappOptInAt),
    };
  }

  async updatePreferences(
    userId: string,
    data: {
      inAppEnabled?: boolean;
      emailEnabled?: boolean;
      whatsappEnabled?: boolean;
      taskAssigned?: boolean;
      taskReassigned?: boolean;
      dueReminder?: boolean;
      upcomingDeadline?: boolean;
      overdueTask?: boolean;
      commentAdded?: boolean;
      userMentioned?: boolean;
      fileUploaded?: boolean;
      reviewUpdates?: boolean;
      taskCompleted?: boolean;
      projectDeadline?: boolean;
      dailyDigestEnabled?: boolean;
    },
  ) {
    if (data.whatsappEnabled !== undefined) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { phone: true, whatsappOptInAt: true },
      });

      if (!user) {
        throw new NotFoundException('User not found.');
      }

      if (data.whatsappEnabled && !user.phone) {
        throw new BadRequestException(
          'Add a phone number before enabling WhatsApp reminders.',
        );
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          whatsappOptInAt: data.whatsappEnabled
            ? user.whatsappOptInAt ?? new Date()
            : null,
        },
      });
    }

    const preference = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        ...data,
      },
      update: { ...data },
    });

    return {
      ...preference,
      whatsappEnabled: preference.whatsappEnabled,
    };
  }

  private async createScheduledNotification(
    userId: string,
    payload: CreateNotificationPayload,
    dayStart: Date,
  ) {
    if (!(await this.isAllowed(userId, payload.kind))) {
      return false;
    }

    const existing = await this.existingToday(
      userId,
      payload.kind,
      payload.entityId,
      dayStart,
    );

    if (existing) {
      return false;
    }

    await this.prisma.notification.create({
      data: {
        userId,
        actorId: payload.actorId ?? null,
        kind: payload.kind,
        title: payload.title,
        message: payload.message,
        entityType: payload.entityType ?? null,
        entityId: payload.entityId ?? null,
        redirectPath: payload.redirectPath ?? null,
      },
    });

    return true;
  }

  private taskRecipientUserIds(task: any, includeProjectManager = false) {
    const ids = (task.assignees ?? []).map(
      (item: any) => item.employee?.userId,
    );

    if (includeProjectManager && task.project?.projectManager?.userId) {
      ids.push(task.project.projectManager.userId);
    }

    return [...new Set(ids.filter(Boolean))] as string[];
  }

  private async scanDueToday(dayStart: Date, dayEnd: Date) {
    const tasks = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        isDraft: false,
        dueAt: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
      select: {
        id: true,
        title: true,
        status: {
          select: { code: true },
        },
        assignees: {
          where: { removedAt: null },
          select: {
            employee: {
              select: { userId: true },
            },
          },
        },
      },
    });

    let created = 0;

    for (const task of tasks) {
      if (this.closedTaskStatuses.has(task.status.code)) {
        continue;
      }

      for (const userId of this.taskRecipientUserIds(task)) {
        const didCreate = await this.createScheduledNotification(
          userId,
          {
            kind: NotificationKind.TASK_DUE_REMINDER,
            title: 'Task due today',
            message: `"${task.title}" is due today.`,
            entityType: 'TASK',
            entityId: task.id,
            redirectPath: `/tasks?task=${task.id}`,
          },
          dayStart,
        );

        if (didCreate) {
          created += 1;
        }
      }
    }

    return created;
  }

  private async scanUpcoming(dayStart: Date, dayEnd: Date) {
    const upcomingDays = this.getPositiveNumber(
      process.env.NOTIFICATION_UPCOMING_DAYS,
      2,
    );

    const upcomingEnd = new Date(
      dayEnd.getTime() + upcomingDays * 24 * 60 * 60 * 1000,
    );

    const tasks = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        isDraft: false,
        dueAt: {
          gte: dayEnd,
          lt: upcomingEnd,
        },
      },
      select: {
        id: true,
        title: true,
        status: {
          select: { code: true },
        },
        assignees: {
          where: { removedAt: null },
          select: {
            employee: {
              select: { userId: true },
            },
          },
        },
      },
    });

    let created = 0;

    for (const task of tasks) {
      if (this.closedTaskStatuses.has(task.status.code)) {
        continue;
      }

      for (const userId of this.taskRecipientUserIds(task)) {
        const didCreate = await this.createScheduledNotification(
          userId,
          {
            kind: NotificationKind.TASK_UPCOMING_DEADLINE,
            title: 'Upcoming task deadline',
            message: `"${task.title}" is due soon.`,
            entityType: 'TASK',
            entityId: task.id,
            redirectPath: `/tasks?task=${task.id}`,
          },
          dayStart,
        );

        if (didCreate) {
          created += 1;
        }
      }
    }

    return created;
  }

  private async scanOverdue(now: Date, dayStart: Date) {
    const lookbackDays = this.getPositiveNumber(
      process.env.NOTIFICATION_OVERDUE_LOOKBACK_DAYS,
      30,
    );

    const lowerBound = new Date(
      now.getTime() - lookbackDays * 24 * 60 * 60 * 1000,
    );

    const tasks = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        isDraft: false,
        dueAt: {
          gte: lowerBound,
          lt: now,
        },
      },
      select: {
        id: true,
        title: true,
        status: {
          select: { code: true },
        },
        assignees: {
          where: { removedAt: null },
          select: {
            employee: {
              select: { userId: true },
            },
          },
        },
        project: {
          select: {
            projectManager: {
              select: { userId: true },
            },
          },
        },
      },
    });

    let created = 0;

    for (const task of tasks) {
      if (this.closedTaskStatuses.has(task.status.code)) {
        continue;
      }

      for (const userId of this.taskRecipientUserIds(task, true)) {
        const didCreate = await this.createScheduledNotification(
          userId,
          {
            kind: NotificationKind.TASK_OVERDUE,
            title: 'Task overdue',
            message: `"${task.title}" has passed its deadline.`,
            entityType: 'TASK',
            entityId: task.id,
            redirectPath: `/tasks?task=${task.id}`,
          },
          dayStart,
        );

        if (didCreate) {
          created += 1;
        }
      }
    }

    return created;
  }

  private async scanProjectDeadlines(now: Date, dayStart: Date) {
    const days = this.getPositiveNumber(
      process.env.PROJECT_DEADLINE_NOTIFICATION_DAYS,
      3,
    );

    const deadline = new Date(
      now.getTime() + days * 24 * 60 * 60 * 1000,
    );

    const projects = await this.prisma.project.findMany({
      where: {
        deletedAt: null,
        deadline: {
          gte: now,
          lte: deadline,
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        projectManager: {
          select: { userId: true },
        },
        members: {
          where: {
            isActive: true,
            leftAt: null,
          },
          select: {
            employee: {
              select: { userId: true },
            },
          },
        },
      },
    });

    let created = 0;

    for (const project of projects) {
      if (this.closedProjectStatuses.has(String(project.status))) {
        continue;
      }

      const recipients = [
        project.projectManager?.userId,
        ...project.members.map((member) => member.employee.userId),
      ].filter(Boolean) as string[];

      for (const userId of [...new Set(recipients)]) {
        const didCreate = await this.createScheduledNotification(
          userId,
          {
            kind: NotificationKind.PROJECT_DEADLINE_APPROACHING,
            title: 'Project deadline approaching',
            message: `"${project.name}" is approaching its deadline.`,
            entityType: 'PROJECT',
            entityId: project.id,
            redirectPath: `/projects?project=${project.id}`,
          },
          dayStart,
        );

        if (didCreate) {
          created += 1;
        }
      }
    }

    return created;
  }

  private async scanDailyDigest(
    now: Date,
    dayStart: Date,
    dayEnd: Date,
    localHour: number,
  ) {
    const digestHour = Math.min(
      23,
      Math.max(
        0,
        Math.floor(
          this.getPositiveNumber(process.env.DAILY_DIGEST_HOUR_LOCAL, 8),
        ),
      ),
    );

    if (localHour < digestHour) {
      return 0;
    }

    const employees = await this.prisma.employeeProfile.findMany({
      where: {
        deletedAt: null,
        employmentStatus: 'ACTIVE',
        user: {
          isActive: true,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        userId: true,
        fullName: true,
        user: {
          select: {
            phone: true,
            whatsappOptInAt: true,
            notificationPreference: {
              select: {
                whatsappEnabled: true,
                dailyDigestEnabled: true,
              },
            },
          },
        },
      },
    });

    let created = 0;

    for (const employee of employees) {
      const tasks = await this.prisma.task.findMany({
        where: {
          deletedAt: null,
          isDraft: false,
          assignees: {
            some: {
              employeeId: employee.id,
              removedAt: null,
            },
          },
        },
        select: {
          dueAt: true,
          status: {
            select: { code: true },
          },
        },
      });

      let dueToday = 0;
      let overdue = 0;
      let upcoming = 0;
      const upcomingEnd = new Date(dayEnd.getTime() + 2 * 24 * 60 * 60 * 1000);

      for (const task of tasks) {
        if (this.closedTaskStatuses.has(task.status.code) || !task.dueAt) {
          continue;
        }

        if (task.dueAt >= dayStart && task.dueAt < dayEnd) {
          dueToday += 1;
        } else if (task.dueAt < now) {
          overdue += 1;
        } else if (task.dueAt >= dayEnd && task.dueAt < upcomingEnd) {
          upcoming += 1;
        }
      }

      if (dueToday === 0 && overdue === 0 && upcoming === 0) {
        continue;
      }

      const inAppAllowed = await this.isAllowed(
        employee.userId,
        NotificationKind.TASK_DAILY_DIGEST,
      );

      if (inAppAllowed) {
        const existing = await this.existingToday(
          employee.userId,
          NotificationKind.TASK_DAILY_DIGEST,
          employee.userId,
          dayStart,
        );

        if (!existing) {
          await this.prisma.notification.create({
            data: {
              userId: employee.userId,
              kind: NotificationKind.TASK_DAILY_DIGEST,
              title: 'Your daily task summary',
              message: `${dueToday} due today · ${overdue} overdue · ${upcoming} upcoming`,
              entityType: 'USER',
              entityId: employee.userId,
              redirectPath: '/tasks',
            },
          });

          created += 1;
        }
      }

      const preference = employee.user.notificationPreference;

      await this.whatsappService.sendDailyDigest({
        userId: employee.userId,
        fullName: employee.fullName,
        phone: employee.user.phone,
        whatsappOptInAt: employee.user.whatsappOptInAt,
        whatsappEnabled: preference?.whatsappEnabled ?? true,
        dailyDigestEnabled: preference?.dailyDigestEnabled ?? true,
        dueToday,
        overdue,
        upcoming,
        dayStart,
      });
    }

    return created;
  }

  async runScheduledNotifications(): Promise<SchedulerStats> {
    if (this.schedulerRunning) {
      return {
        dueToday: 0,
        upcoming: 0,
        overdue: 0,
        projectDeadline: 0,
        dailyDigest: 0,
      };
    }

    this.schedulerRunning = true;

    try {
      const now = new Date();
      const {
        start: dayStart,
        end: dayEnd,
        localHour,
      } = this.getLocalDayBounds(now);

      const dueToday = await this.scanDueToday(dayStart, dayEnd);
      const upcoming = await this.scanUpcoming(dayStart, dayEnd);
      const overdue = await this.scanOverdue(now, dayStart);
      const projectDeadline = await this.scanProjectDeadlines(now, dayStart);
      const dailyDigest = await this.scanDailyDigest(
        now,
        dayStart,
        dayEnd,
        localHour,
      );

      return {
        dueToday,
        upcoming,
        overdue,
        projectDeadline,
        dailyDigest,
      };
    } finally {
      this.schedulerRunning = false;
    }
  }
}
