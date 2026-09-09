import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationsService } from './notifications.service';

type ReminderRunResult = {
  dueToday: number;
  upcoming: number;
  overdue: number;
  projectDeadline: number;
  dailyDigest: number;
};

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(
  JwtAuthGuard,
  PermissionsGuard,
)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  private userId(
    request: any,
  ) {
    const id =
      request?.user?.id ??
      request?.user?.sub;

    if (!id) {
      throw new UnauthorizedException();
    }

    return String(id);
  }

  @Get()
  @Permissions('dashboard.view')
  findAll(
    @Req()
    request: any,
    @Query('limit')
    limit?: string,
    @Query('unreadOnly')
    unreadOnly?: string,
  ) {
    const parsedLimit =
      Number(limit);

    return this.notificationsService.findAll(
      this.userId(request),
      Number.isFinite(
        parsedLimit,
      )
        ? parsedLimit
        : 50,
      unreadOnly ===
        'true',
    );
  }

  @Get('unread-count')
  @Permissions('dashboard.view')
  unreadCount(
    @Req()
    request: any,
  ) {
    return this.notificationsService.unreadCount(
      this.userId(request),
    );
  }

  @Get('preferences')
  @Permissions('dashboard.view')
  getPreferences(
    @Req()
    request: any,
  ) {
    return this.notificationsService.getPreferences(
      this.userId(request),
    );
  }

  @Patch('preferences')
  @Permissions('dashboard.view')
  updatePreferences(
    @Req()
    request: any,
    @Body()
    dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(
      this.userId(request),
      dto,
    );
  }

  @Patch('read-all')
  @Permissions('dashboard.view')
  markAllRead(
    @Req()
    request: any,
  ) {
    return this.notificationsService.markAllRead(
      this.userId(request),
    );
  }

  @Patch(':id/read')
  @Permissions('dashboard.view')
  markRead(
    @Req()
    request: any,
    @Param('id')
    id: string,
  ) {
    return this.notificationsService.markRead(
      this.userId(request),
      id,
    );
  }

  @Post('run-reminders')
  @Permissions('tasks.view_all')
  async runReminders(): Promise<ReminderRunResult> {
    return this.notificationsService.runScheduledNotifications();
  }
}
