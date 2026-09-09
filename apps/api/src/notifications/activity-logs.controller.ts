import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

import { ActivityLogsService } from './activity-logs.service';

@ApiTags('Activity Logs')
@ApiBearerAuth()
@Controller('activity-logs')
@UseGuards(
  JwtAuthGuard,
  PermissionsGuard,
)
export class ActivityLogsController {
  constructor(
    private readonly service: ActivityLogsService,
  ) {}

  @Get('options')
  @Permissions('activity_logs.view')
  options() {
    return this.service.options();
  }

  @Get('summary')
  @Permissions('activity_logs.view')
  summary() {
    return this.service.summary();
  }

  @Get('login-history')
  @Permissions('activity_logs.view')
  loginHistory(
    @Query('page')
    page?: string,
    @Query('limit')
    limit?: string,
    @Query('search')
    search?: string,
    @Query('userId')
    userId?: string,
    @Query('eventType')
    eventType?: string,
    @Query('start')
    start?: string,
    @Query('end')
    end?: string,
    @Query('sort')
    sort?: string,
  ) {
    return this.service.loginHistory({
      page,
      limit,
      search,
      userId,
      eventType,
      start,
      end,
      sort,
    });
  }

  @Get()
  @Permissions('activity_logs.view')
  activity(
    @Query('page')
    page?: string,
    @Query('limit')
    limit?: string,
    @Query('search')
    search?: string,
    @Query('userId')
    userId?: string,
    @Query('action')
    action?: string,
    @Query('entityType')
    entityType?: string,
    @Query('start')
    start?: string,
    @Query('end')
    end?: string,
    @Query('sort')
    sort?: string,
  ) {
    return this.service.activity({
      page,
      limit,
      search,
      userId,
      action,
      entityType,
      start,
      end,
      sort,
    });
  }
}
