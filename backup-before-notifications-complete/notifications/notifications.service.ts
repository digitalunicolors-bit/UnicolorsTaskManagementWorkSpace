import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import {
  NotificationKind,
} from '../generated/prisma/enums';

type NotificationPayload = {
  actorId?: string;
  kind: NotificationKind;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  redirectPath?: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private async allowedUsers(
    userIds: string[],
    kind: NotificationKind,
  ) {
    const uniqueIds = [
      ...new Set(userIds),
    ];

    if (!uniqueIds.length) {
      return [];
    }

    const preferences =
      await this.prisma.notificationPreference.findMany({
        where: {
          userId: {
            in: uniqueIds,
          },
        },
      });

    const preferenceMap = new Map(
      preferences.map((item) => [
        item.userId,
        item,
      ]),
    );

    return uniqueIds.filter((userId) => {
      const pref =
        preferenceMap.get(userId);

      if (!pref) {
        return true;
      }

      if (!pref.inAppEnabled) {
        return false;
      }

      switch (kind) {
        case NotificationKind.TASK_ASSIGNED:
          return pref.taskAssigned;

        case NotificationKind.TASK_REASSIGNED:
          return pref.taskReassigned;

        case NotificationKind.TASK_DUE_REMINDER:
        case NotificationKind.TASK_BEFORE_DUE:
        case NotificationKind.TASK_CUSTOM_REMINDER:
          return pref.dueReminder;

        case NotificationKind.TASK_UPCOMING_DEADLINE:
          return pref.upcomingDeadline;

        case NotificationKind.TASK_OVERDUE:
          return pref.overdueTask;

        case NotificationKind.COMMENT_ADDED:
          return pref.commentAdded;

        case NotificationKind.USER_MENTIONED:
          return pref.userMentioned;

        case NotificationKind.FILE_UPLOADED:
          return pref.fileUploaded;

        case NotificationKind.TASK_SUBMITTED_FOR_REVIEW:
        case NotificationKind.TASK_APPROVED:
        case NotificationKind.TASK_CHANGES_REQUESTED:
          return pref.reviewUpdates;

        case NotificationKind.TASK_COMPLETED:
          return pref.taskCompleted;

        case NotificationKind.PROJECT_DEADLINE_APPROACHING:
          return pref.projectDeadline;

        case NotificationKind.TASK_DAILY_DIGEST:
          return pref.dailyDigestEnabled;

        default:
          return true;
      }
    });
  }

  async createForUsers(
    userIds: string[],
    payload: NotificationPayload,
  ) {
    let recipients =
      await this.allowedUsers(
        userIds,
        payload.kind,
      );

    if (payload.actorId) {
      recipients = recipients.filter(
        (userId) =>
          userId !== payload.actorId,
      );
    }

    if (!recipients.length) {
      return;
    }

    await this.prisma.notification.createMany({
      data: recipients.map(
        (userId) => ({
          userId,
          actorId:
            payload.actorId ?? null,
          kind: payload.kind,
          title: payload.title,
          message: payload.message,
          entityType:
            payload.entityType ?? null,
          entityId:
            payload.entityId ?? null,
          redirectPath:
            payload.redirectPath ?? null,
        }),
      ),
    });
  }

  async notifyEmployees(
    employeeIds: string[],
    payload: NotificationPayload,
  ) {
    if (!employeeIds.length) {
      return;
    }

    const employees =
      await this.prisma.employeeProfile.findMany({
        where: {
          id: {
            in: employeeIds,
          },
          deletedAt: null,
        },
        select: {
          userId: true,
        },
      });

    await this.createForUsers(
      employees.map(
        (item) => item.userId,
      ),
      payload,
    );
  }

  async notifyTaskAssignees(
    taskId: string,
    actorId: string,
    kind: NotificationKind,
    title: string,
    message: string,
  ) {
    const task =
      await this.prisma.task.findFirst({
        where: {
          id: taskId,
          deletedAt: null,
        },
        select: {
          assignees: {
            where: {
              removedAt: null,
            },
            select: {
              employeeId: true,
            },
          },
        },
      });

    if (!task) {
      return;
    }

    await this.notifyEmployees(
      task.assignees.map(
        (item) => item.employeeId,
      ),
      {
        actorId,
        kind,
        title,
        message,
        entityType: 'TASK',
        entityId: taskId,
        redirectPath:
          `/tasks?task=${taskId}`,
      },
    );
  }

  async notifyTaskReviewers(
    taskId: string,
    actorId: string,
    kind: NotificationKind,
    title: string,
    message: string,
  ) {
    const task =
      await this.prisma.task.findFirst({
        where: {
          id: taskId,
          deletedAt: null,
        },
        select: {
          reviewers: {
            select: {
              employeeId: true,
            },
          },
        },
      });

    if (!task) {
      return;
    }

    await this.notifyEmployees(
      task.reviewers.map(
        (item) => item.employeeId,
      ),
      {
        actorId,
        kind,
        title,
        message,
        entityType: 'TASK',
        entityId: taskId,
        redirectPath:
          `/tasks?task=${taskId}`,
      },
    );
  }

  async list(
    userId: string,
  ) {
    return this.prisma.notification.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 30,
    });
  }

  async unreadCount(
    userId: string,
  ) {
    const count =
      await this.prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      });

    return {
      count,
    };
  }

  async markRead(
    id: string,
    userId: string,
  ) {
    const notification =
      await this.prisma.notification.findFirst({
        where: {
          id,
          userId,
        },
        select: {
          id: true,
        },
      });

    if (!notification) {
      throw new NotFoundException(
        'Notification not found.',
      );
    }

    return this.prisma.notification.update({
      where: {
        id,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllRead(
    userId: string,
  ) {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      success: true,
    };
  }
}