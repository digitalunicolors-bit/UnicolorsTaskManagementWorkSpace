import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CalendarService } from './calendar.service';

@ApiTags('Calendar')
@ApiBearerAuth()
@Controller('calendar')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  private userId(request: any) {
    const id = request?.user?.id ?? request?.user?.sub;
    if (!id) throw new UnauthorizedException();
    return String(id);
  }

  @Get('events')
  @Permissions('dashboard.view')
  events(
    @Req() request: any,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('employeeId') employeeId?: string,
    @Query('clientId') clientId?: string,
    @Query('projectId') projectId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('priority') priority?: string,
  ) {
    return this.calendarService.getEvents(this.userId(request), {
      start,
      end,
      employeeId,
      clientId,
      projectId,
      departmentId,
      priority,
    });
  }

  @Get('options')
  @Permissions('dashboard.view')
  options(@Req() request: any) {
    return this.calendarService.getOptions(this.userId(request));
  }
}
