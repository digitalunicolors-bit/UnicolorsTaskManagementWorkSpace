import {
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

import { NotificationsService } from './notifications.service';

type AuthRequest = {
  user?: {
    id?: string;
    sub?: string;
    userId?: string;
  };
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
    private readonly notificationsService:
      NotificationsService,
  ) {}

  private getUserId(
    request: AuthRequest,
  ) {
    const userId =
      request.user?.id ??
      request.user?.userId ??
      request.user?.sub;

    if (!userId) {
      throw new UnauthorizedException();
    }

    return userId;
  }

  @Get()
  @Permissions('dashboard.view')
  list(
    @Req()
    request: AuthRequest,
  ) {
    return this.notificationsService.list(
      this.getUserId(request),
    );
  }

  @Get('unread-count')
  @Permissions('dashboard.view')
  unreadCount(
    @Req()
    request: AuthRequest,
  ) {
    return this.notificationsService.unreadCount(
      this.getUserId(request),
    );
  }

  @Patch('read-all')
  @Permissions('dashboard.view')
  markAllRead(
    @Req()
    request: AuthRequest,
  ) {
    return this.notificationsService.markAllRead(
      this.getUserId(request),
    );
  }

  @Patch(':id/read')
  @Permissions('dashboard.view')
  markRead(
    @Param('id')
    id: string,

    @Req()
    request: AuthRequest,
  ) {
    return this.notificationsService.markRead(
      id,
      this.getUserId(request),
    );
  }
}