import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { NotificationKind } from '../generated/prisma/enums';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
  ) {}

  private readonly includeComment = {
    author: {
      select: {
        id: true,
        email: true,
        phone: true,
        employeeProfile: {
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
    mentions: {
      select: {
        id: true,
        mentionedUserId: true,
        mentionedUser: {
          select: {
            id: true,
            employeeProfile: {
              select: {
                id: true,
                employeeId: true,
                username: true,
                fullName: true,
                designation: true,
              },
            },
          },
        },
      },
    },
    _count: {
      select: {
        replies: true,
        reactions: true,
        files: true,
      },
    },
  } as const;

  private async hasPermission(
    userId: string,
    code: string,
  ) {
    return Boolean(
      await this.prisma.userRole.findFirst({
        where: {
          userId,
          role: {
            isActive: true,
            permissions: {
              some: {
                permission: { code },
              },
            },
          },
        },
        select: { id: true },
      }),
    );
  }

  private extractUsernames(content: string) {
    return [
      ...new Set(
        Array.from(
          content.matchAll(
            /@([A-Za-z0-9._-]{3,30})/g,
          ),
          (match) => match[1].toLowerCase(),
        ),
      ),
    ];
  }

  private async resolveMentionedUsers(
    content: string,
    explicitUserIds: string[] = [],
  ) {
    const usernames =
      this.extractUsernames(content);

    const [profiles, users] =
      await Promise.all([
        usernames.length
          ? this.prisma.employeeProfile.findMany({
              where: {
                username: { in: usernames },
                deletedAt: null,
                user: {
                  isActive: true,
                  deletedAt: null,
                },
              },
              select: { userId: true },
            })
          : Promise.resolve([]),
        explicitUserIds.length
          ? this.prisma.user.findMany({
              where: {
                id: {
                  in: [...new Set(explicitUserIds)],
                },
                isActive: true,
                deletedAt: null,
              },
              select: { id: true },
            })
          : Promise.resolve([]),
      ]);

    return [
      ...new Set([
        ...profiles.map((item) => item.userId),
        ...users.map((item) => item.id),
      ]),
    ];
  }

  private async actorName(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        email: true,
        phone: true,
        employeeProfile: {
          select: {
            fullName: true,
            username: true,
          },
        },
      },
    });

    return (
      user?.employeeProfile?.fullName ||
      (user?.employeeProfile?.username
        ? `@${user.employeeProfile.username}`
        : null) ||
      user?.email ||
      user?.phone ||
      'A team member'
    );
  }

  private async taskRecipients(taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        title: true,
        createdById: true,
        assignees: {
          where: { removedAt: null },
          select: {
            employee: { select: { userId: true } },
          },
        },
        collaborators: {
          where: { removedAt: null },
          select: {
            employee: { select: { userId: true } },
          },
        },
        reviewers: {
          select: {
            employee: { select: { userId: true } },
          },
        },
        followers: {
          select: {
            employee: { select: { userId: true } },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    const recipients = new Set<string>([
      task.createdById,
      ...task.assignees.map((x) => x.employee.userId),
      ...task.collaborators.map((x) => x.employee.userId),
      ...task.reviewers.map((x) => x.employee.userId),
      ...task.followers.map((x) => x.employee.userId),
    ]);

    return { task, recipients: [...recipients] };
  }

  private async createNotifications(
    userIds: string[],
    actorId: string,
    kind: NotificationKind,
    preferenceKey: 'commentAdded' | 'userMentioned',
    title: string,
    message: string,
    taskId: string,
  ) {
    const ids = [
      ...new Set(userIds.filter((id) => id && id !== actorId)),
    ];

    if (!ids.length) return;

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: ids },
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        notificationPreference: {
          select: {
            inAppEnabled: true,
            commentAdded: true,
            userMentioned: true,
          },
        },
      },
    });

    const allowed = users.filter((user) => {
      const pref = user.notificationPreference;
      if (pref?.inAppEnabled === false) return false;
      if (pref && pref[preferenceKey] === false) return false;
      return true;
    });

    if (!allowed.length) return;

    await this.prisma.notification.createMany({
      data: allowed.map((user) => ({
        userId: user.id,
        actorId,
        kind,
        title,
        message,
        entityType: 'TASK',
        entityId: taskId,
        redirectPath: `/tasks?task=${taskId}`,
      })),
    });
  }

  async findTaskComments(taskId: string, userId: string) {
    await this.tasksService.findOneForUser(taskId, userId);

    return this.prisma.comment.findMany({
      where: { taskId, deletedAt: null },
      include: this.includeComment,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async createTaskComment(
    taskId: string,
    userId: string,
    dto: CreateTaskCommentDto,
  ) {
    await this.tasksService.findOneForUser(taskId, userId);

    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('Comment cannot be empty.');
    }

    if (dto.parentId) {
      const parent = await this.prisma.comment.findFirst({
        where: {
          id: dto.parentId,
          taskId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!parent) {
        throw new BadRequestException(
          'Reply target was not found in this task.',
        );
      }
    }

    const mentionedUserIds =
      await this.resolveMentionedUsers(
        content,
        dto.mentionedUserIds,
      );

    const comment = await this.prisma.comment.create({
      data: {
        taskId,
        authorId: userId,
        parentId: dto.parentId || null,
        content,
        mentions: mentionedUserIds.length
          ? {
              create: mentionedUserIds.map(
                (mentionedUserId) => ({ mentionedUserId }),
              ),
            }
          : undefined,
      },
      include: this.includeComment,
    });

    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'COMMENT_ADDED',
        entityType: 'TASK',
        entityId: taskId,
        metadata: {
          commentId: comment.id,
          parentId: dto.parentId || null,
        },
      },
    });

    const { task, recipients } =
      await this.taskRecipients(taskId);
    const name = await this.actorName(userId);
    const mentioned = new Set(mentionedUserIds);

    await Promise.all([
      this.createNotifications(
        recipients.filter((id) => !mentioned.has(id)),
        userId,
        NotificationKind.COMMENT_ADDED,
        'commentAdded',
        'New task comment',
        `${name} commented on "${task.title}".`,
        taskId,
      ),
      this.createNotifications(
        mentionedUserIds,
        userId,
        NotificationKind.USER_MENTIONED,
        'userMentioned',
        'You were mentioned',
        `${name} mentioned you in "${task.title}".`,
        taskId,
      ),
    ]);

    return comment;
  }

  private async commentForMutation(
    commentId: string,
    userId: string,
  ) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, deletedAt: null },
      select: {
        id: true,
        taskId: true,
        authorId: true,
        content: true,
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }
    if (!comment.taskId) {
      throw new BadRequestException(
        'This endpoint only manages task comments.',
      );
    }

    await this.tasksService.findOneForUser(comment.taskId, userId);

    const canManage = await this.hasPermission(
      userId,
      'comments.manage',
    );

    if (comment.authorId !== userId && !canManage) {
      throw new ForbiddenException(
        'You can only manage your own comments.',
      );
    }

    return comment;
  }

  async updateComment(
    commentId: string,
    userId: string,
    dto: UpdateCommentDto,
  ) {
    const existing = await this.commentForMutation(
      commentId,
      userId,
    );
    const content = dto.content.trim();

    if (!content) {
      throw new BadRequestException('Comment cannot be empty.');
    }

    const mentionedUserIds =
      await this.resolveMentionedUsers(content);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.commentMention.deleteMany({
        where: { commentId },
      });

      return tx.comment.update({
        where: { id: commentId },
        data: {
          content,
          editedAt: new Date(),
          mentions: mentionedUserIds.length
            ? {
                create: mentionedUserIds.map(
                  (mentionedUserId) => ({ mentionedUserId }),
                ),
              }
            : undefined,
        },
        include: this.includeComment,
      });
    });

    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'COMMENT_UPDATED',
        entityType: 'TASK',
        entityId: existing.taskId,
        previousValue: { content: existing.content },
        newValue: { content },
        metadata: { commentId },
      },
    });

    return updated;
  }

  async deleteComment(commentId: string, userId: string) {
    const existing = await this.commentForMutation(
      commentId,
      userId,
    );

    await this.prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'COMMENT_DELETED',
        entityType: 'TASK',
        entityId: existing.taskId,
        metadata: { commentId },
      },
    });

    return { success: true };
  }
}
