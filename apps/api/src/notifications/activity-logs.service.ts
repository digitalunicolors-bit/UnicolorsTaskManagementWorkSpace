import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

type ActivityQuery = {
  page?: string;
  limit?: string;
  search?: string;
  userId?: string;
  action?: string;
  entityType?: string;
  start?: string;
  end?: string;
  sort?: string;
};

type LoginQuery = {
  page?: string;
  limit?: string;
  search?: string;
  userId?: string;
  eventType?: string;
  start?: string;
  end?: string;
  sort?: string;
};

@Injectable()
export class ActivityLogsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private numberValue(
    value: string | undefined,
    fallback: number,
    min: number,
    max: number,
  ) {
    if (!value) {
      return fallback;
    }

    const parsed =
      Number(value);

    if (
      !Number.isFinite(parsed)
    ) {
      return fallback;
    }

    return Math.min(
      max,
      Math.max(
        min,
        Math.floor(parsed),
      ),
    );
  }

  private dateValue(
    value: string | undefined,
  ) {
    if (!value) {
      return undefined;
    }

    const parsed =
      new Date(value);

    if (
      Number.isNaN(
        parsed.getTime(),
      )
    ) {
      throw new BadRequestException(
        'Invalid activity log date.',
      );
    }

    return parsed;
  }

  private dateFilter(
    start?: string,
    end?: string,
  ) {
    const from =
      this.dateValue(start);

    const to =
      this.dateValue(end);

    if (
      from &&
      to &&
      to <= from
    ) {
      throw new BadRequestException(
        'End date must be after start date.',
      );
    }

    if (
      !from &&
      !to
    ) {
      return undefined;
    }

    return {
      ...(from
        ? {
            gte: from,
          }
        : {}),
      ...(to
        ? {
            lt: to,
          }
        : {}),
    };
  }

  private userSelect() {
    return {
      id: true,
      email: true,
      phone: true,
      employeeProfile: {
        select: {
          id: true,
          employeeId: true,
          fullName: true,
          username: true,
          designation: true,
          profileImageUrl: true,
        },
      },
    } as const;
  }

  async options() {
    const [
      actions,
      entityTypes,
      users,
    ] =
      await Promise.all([
        this.prisma.activityLog.findMany({
          distinct: [
            'action',
          ],
          select: {
            action: true,
          },
          orderBy: {
            action: 'asc',
          },
          take: 500,
        }),

        this.prisma.activityLog.findMany({
          distinct: [
            'entityType',
          ],
          select: {
            entityType:
              true,
          },
          orderBy: {
            entityType:
              'asc',
          },
          take: 500,
        }),

        this.prisma.user.findMany({
          where: {
            deletedAt:
              null,
          },
          select:
            this.userSelect(),
          orderBy: {
            email:
              'asc',
          },
          take: 1000,
        }),
      ]);

    return {
      actions:
        actions.map(
          (item) =>
            item.action,
        ),
      entityTypes:
        entityTypes.map(
          (item) =>
            item.entityType,
        ),
      users:
        users.map(
          (user) => ({
            id:
              user.id,
            label:
              user.employeeProfile?.fullName ??
              user.email ??
              user.phone ??
              'User',
            employeeId:
              user.employeeProfile?.employeeId ??
              null,
            username:
              user.employeeProfile?.username ??
              null,
            email:
              user.email,
          }),
        ),
      loginEventTypes: [
        'LOGIN_SUCCESS',
        'LOGIN_FAILED',
        'LOGOUT',
        'SESSION_EXPIRED',
        'SESSION_REVOKED',
      ],
    };
  }

  async activity(
    query: ActivityQuery,
  ) {
    const page =
      this.numberValue(
        query.page,
        1,
        1,
        100000,
      );

    const limit =
      this.numberValue(
        query.limit,
        50,
        10,
        200,
      );

    const search =
      query.search?.trim();

    const createdAt =
      this.dateFilter(
        query.start,
        query.end,
      );

    const where: any = {
      ...(query.userId
        ? {
            userId:
              query.userId,
          }
        : {}),
      ...(query.action
        ? {
            action:
              query.action,
          }
        : {}),
      ...(query.entityType
        ? {
            entityType:
              query.entityType,
          }
        : {}),
      ...(createdAt
        ? {
            createdAt,
          }
        : {}),
    };

    if (search) {
      where.OR = [
        {
          action: {
            contains:
              search,
            mode:
              'insensitive',
          },
        },
        {
          entityType: {
            contains:
              search,
            mode:
              'insensitive',
          },
        },
        {
          entityId: {
            contains:
              search,
            mode:
              'insensitive',
          },
        },
        {
          user: {
            email: {
              contains:
                search,
              mode:
                'insensitive',
            },
          },
        },
        {
          user: {
            employeeProfile: {
              fullName: {
                contains:
                  search,
                mode:
                  'insensitive',
              },
            },
          },
        },
      ];
    }

    const direction =
      query.sort ===
      'oldest'
        ? 'asc'
        : 'desc';

    const [
      total,
      rows,
    ] =
      await Promise.all([
        this.prisma.activityLog.count({
          where,
        }),

        this.prisma.activityLog.findMany({
          where,
          include: {
            user: {
              select:
                this.userSelect(),
            },
          },
          orderBy: {
            createdAt:
              direction,
          },
          skip:
            (
              page -
              1
            ) *
            limit,
          take:
            limit,
        }),
      ]);

    return {
      page,
      limit,
      total,
      totalPages:
        Math.max(
          1,
          Math.ceil(
            total /
            limit,
          ),
        ),
      rows,
    };
  }

  async loginHistory(
    query: LoginQuery,
  ) {
    const page =
      this.numberValue(
        query.page,
        1,
        1,
        100000,
      );

    const limit =
      this.numberValue(
        query.limit,
        50,
        10,
        200,
      );

    const search =
      query.search?.trim();

    const createdAt =
      this.dateFilter(
        query.start,
        query.end,
      );

    const where: any = {
      ...(query.userId
        ? {
            userId:
              query.userId,
          }
        : {}),
      ...(query.eventType
        ? {
            eventType:
              query.eventType,
          }
        : {}),
      ...(createdAt
        ? {
            createdAt,
          }
        : {}),
    };

    if (search) {
      where.OR = [
        {
          identifier: {
            contains:
              search,
            mode:
              'insensitive',
          },
        },
        {
          ipAddress: {
            contains:
              search,
            mode:
              'insensitive',
          },
        },
        {
          deviceName: {
            contains:
              search,
            mode:
              'insensitive',
          },
        },
        {
          browser: {
            contains:
              search,
            mode:
              'insensitive',
          },
        },
        {
          os: {
            contains:
              search,
            mode:
              'insensitive',
          },
        },
        {
          user: {
            email: {
              contains:
                search,
              mode:
                'insensitive',
            },
          },
        },
        {
          user: {
            employeeProfile: {
              fullName: {
                contains:
                  search,
                mode:
                  'insensitive',
              },
            },
          },
        },
      ];
    }

    const direction =
      query.sort ===
      'oldest'
        ? 'asc'
        : 'desc';

    const [
      total,
      rows,
    ] =
      await Promise.all([
        this.prisma.loginHistory.count({
          where,
        }),

        this.prisma.loginHistory.findMany({
          where,
          include: {
            user: {
              select:
                this.userSelect(),
            },
          },
          orderBy: {
            createdAt:
              direction,
          },
          skip:
            (
              page -
              1
            ) *
            limit,
          take:
            limit,
        }),
      ]);

    return {
      page,
      limit,
      total,
      totalPages:
        Math.max(
          1,
          Math.ceil(
            total /
            limit,
          ),
        ),
      rows,
    };
  }

  async summary() {
    const now =
      new Date();

    const startToday =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );

    const startWeek =
      new Date(
        startToday,
      );

    startWeek.setDate(
      startWeek.getDate() -
        6,
    );

    const [
      actionsToday,
      actionsWeek,
      uniqueUsers,
      failedLoginsToday,
      latestAction,
    ] =
      await Promise.all([
        this.prisma.activityLog.count({
          where: {
            createdAt: {
              gte:
                startToday,
            },
          },
        }),

        this.prisma.activityLog.count({
          where: {
            createdAt: {
              gte:
                startWeek,
            },
          },
        }),

        this.prisma.activityLog.findMany({
          where: {
            createdAt: {
              gte:
                startWeek,
            },
            userId: {
              not:
                null,
            },
          },
          distinct: [
            'userId',
          ],
          select: {
            userId: true,
          },
        }),

        this.prisma.loginHistory.count({
          where: {
            eventType:
              'LOGIN_FAILED',
            createdAt: {
              gte:
                startToday,
            },
          },
        }),

        this.prisma.activityLog.findFirst({
          orderBy: {
            createdAt:
              'desc',
          },
          select: {
            createdAt:
              true,
          },
        }),
      ]);

    return {
      actionsToday,
      actionsLast7Days:
        actionsWeek,
      activeUsersLast7Days:
        uniqueUsers.length,
      failedLoginsToday,
      latestActionAt:
        latestAction?.createdAt ??
        null,
    };
  }
}
