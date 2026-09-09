import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogInterceptor
  implements NestInterceptor
{
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const request =
      context.switchToHttp().getRequest();

    const response =
      context.switchToHttp().getResponse();

    const method =
      String(
        request?.method ??
        '',
      ).toUpperCase();

    const path =
      String(
        request?.originalUrl ??
        request?.url ??
        '',
      );

    if (
      ![
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
      ].includes(
        method,
      ) ||
      this.shouldSkip(
        path,
      )
    ) {
      return next.handle();
    }

    const startedAt =
      Date.now();

    return next.handle().pipe(
      tap({
        next: (
          result,
        ) => {
          void this.writeLog({
            request,
            response,
            result,
            method,
            path,
            startedAt,
          });
        },
      }),
    );
  }

  private shouldSkip(
    path: string,
  ) {
    return (
      path.includes(
        '/activity-logs',
      ) ||
      path.includes(
        '/auth/',
      ) ||
      path.includes(
        '/health',
      ) ||
      (
        path.includes(
          '/notifications/',
        ) &&
        (
          path.includes(
            '/read',
          ) ||
          path.includes(
            '/read-all',
          )
        )
      )
    );
  }

  private redact(
    value: any,
    depth = 0,
  ): any {
    if (
      value ===
        null ||
      value ===
        undefined
    ) {
      return value;
    }

    if (
      depth >
      5
    ) {
      return '[TRUNCATED]';
    }

    if (
      Array.isArray(
        value,
      )
    ) {
      return value
        .slice(
          0,
          100,
        )
        .map(
          (item) =>
            this.redact(
              item,
              depth +
                1,
            ),
        );
    }

    if (
      typeof value ===
      'object'
    ) {
      const output:
        Record<
          string,
          any
        > = {};

      for (
        const [
          key,
          item,
        ] of Object.entries(
          value,
        )
      ) {
        const normalized =
          key.toLowerCase();

        if (
          normalized.includes(
            'password',
          ) ||
          normalized.includes(
            'token',
          ) ||
          normalized.includes(
            'secret',
          ) ||
          normalized.includes(
            'authorization',
          ) ||
          normalized.includes(
            'cookie',
          )
        ) {
          output[key] =
            '[REDACTED]';
          continue;
        }

        output[key] =
          this.redact(
            item,
            depth +
              1,
          );
      }

      return output;
    }

    if (
      typeof value ===
      'string' &&
      value.length >
        5000
    ) {
      return `${value.slice(
        0,
        5000,
      )}...[TRUNCATED]`;
    }

    return value;
  }

  private entityFromPath(
    path: string,
  ) {
    const clean =
      path
        .split(
          '?',
        )[0]
        .replace(
          /^\/api\/v1\//,
          '',
        );

    const segment =
      clean
        .split(
          '/',
        )
        .filter(
          Boolean,
        )[0] ??
      'SYSTEM';

    const mapping:
      Record<
        string,
        string
      > = {
        tasks:
          'TASK',
        kanban:
          'TASK',
        projects:
          'PROJECT',
        clients:
          'CLIENT',
        employees:
          'EMPLOYEE',
        departments:
          'DEPARTMENT',
        teams:
          'TEAM',
        comments:
          'COMMENT',
        attachments:
          'FILE',
        files:
          'FILE',
        'voice-notes':
          'VOICE_NOTE',
        'time-entries':
          'TIME_ENTRY',
        'recurring-tasks':
          'RECURRING_TASK',
        notifications:
          'NOTIFICATION',
        settings:
          'SETTING',
      };

    return (
      mapping[
        segment
      ] ??
      segment
        .replace(
          /-/g,
          '_',
        )
        .toUpperCase()
    );
  }

  private actionFrom(
    method: string,
    path: string,
    body: any,
  ) {
    const clean =
      path
        .split(
          '?',
        )[0];

    if (
      method === 'POST' &&
      /\/clients\/?$/.test(clean)
    ) {
      return 'CLIENT_ONBOARDING_CREATED';
    }

    if (
      method === 'PATCH' &&
      /\/clients\/[^/]+\/onboarding$/.test(clean)
    ) {
      return 'CLIENT_ONBOARDING_STAGE_CHANGED';
    }

    if (
      method ===
        'PATCH' &&
      /\/tasks\/[^/]+$/.test(
        clean,
      ) &&
      body &&
      Object.prototype.hasOwnProperty.call(
        body,
        'dueAt',
      )
    ) {
      return 'TASK_DEADLINE_CHANGED';
    }

    if (
      /\/kanban\/[^/]+\/move$/.test(
        clean,
      )
    ) {
      return 'TASK_WORKFLOW_CHANGED';
    }

    if (
      /\/time-entries\/start$/.test(
        clean,
      )
    ) {
      return 'TIME_ENTRY_STARTED';
    }

    if (
      /\/time-entries\/manual$/.test(
        clean,
      )
    ) {
      return 'TIME_ENTRY_MANUAL_CREATED';
    }

    if (
      /\/time-entries\/[^/]+\/pause$/.test(
        clean,
      )
    ) {
      return 'TIME_ENTRY_PAUSED';
    }

    if (
      /\/time-entries\/[^/]+\/resume$/.test(
        clean,
      )
    ) {
      return 'TIME_ENTRY_RESUMED';
    }

    if (
      /\/time-entries\/[^/]+\/stop$/.test(
        clean,
      )
    ) {
      return 'TIME_ENTRY_STOPPED';
    }

    const entity =
      this.entityFromPath(
        path,
      );

    const suffix =
      method ===
      'POST'
        ? 'CREATED'
        : method ===
            'DELETE'
          ? 'DELETED'
          : 'UPDATED';

    return `${entity}_${suffix}`;
  }

  private entityId(
    request: any,
    result: any,
  ) {
    const paramId =
      request?.params?.id ??
      request?.params?.taskId ??
      request?.params?.projectId ??
      request?.params?.clientId;

    if (paramId) {
      return String(
        paramId,
      );
    }

    const resultId =
      result?.id ??
      result?.taskId ??
      result?.projectId ??
      result?.clientId ??
      result?.data?.id;

    return resultId
      ? String(
          resultId,
        )
      : null;
  }

  private ipAddress(
    request: any,
  ) {
    const forwarded =
      request?.headers?.[
        'x-forwarded-for'
      ];

    if (
      typeof forwarded ===
      'string'
    ) {
      return forwarded
        .split(
          ',',
        )[0]
        .trim();
    }

    return (
      request?.ip ??
      request?.socket?.remoteAddress ??
      null
    );
  }

  private async writeLog({
    request,
    response,
    result,
    method,
    path,
    startedAt,
  }: {
    request: any;
    response: any;
    result: any;
    method: string;
    path: string;
    startedAt: number;
  }) {
    try {
      const userId =
        request?.user?.id ??
        request?.user?.sub ??
        null;

      await this.prisma.activityLog.create({
        data: {
          userId:
            userId
              ? String(
                  userId,
                )
              : null,
          action:
            this.actionFrom(
              method,
              path,
              request?.body,
            ),
          entityType:
            this.entityFromPath(
              path,
            ),
          entityId:
            this.entityId(
              request,
              result,
            ),
          ipAddress:
            this.ipAddress(
              request,
            ),
          userAgent:
            request?.headers?.[
              'user-agent'
            ] ??
            null,
          newValue:
            this.redact(
              request?.body ??
              null,
            ),
          metadata: {
            method,
            path:
              path.split(
                '?',
              )[0],
            params:
              this.redact(
                request?.params ??
                {},
              ),
            query:
              this.redact(
                request?.query ??
                {},
              ),
            statusCode:
              response?.statusCode ??
              null,
            durationMs:
              Date.now() -
              startedAt,
          },
        },
      });
    } catch (error) {
      // Audit logging must never break the user's successful request.
      console.error(
        '[AuditLogInterceptor]',
        error,
      );
    }
  }
}
