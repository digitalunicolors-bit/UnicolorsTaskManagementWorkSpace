import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

import { ActivityLogsController } from './activity-logs.controller';
import { ActivityLogsService } from './activity-logs.service';
import { AuditLogInterceptor } from './audit-log.interceptor';

import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { KanbanController } from './kanban.controller';
import { KanbanService } from './kanban.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { WhatsappService } from './whatsapp.service';
import { RecurringTasksController } from './recurring-tasks.controller';
import { RecurringTasksService } from './recurring-tasks.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { TimeEntriesController } from './time-entries.controller';
import { TimeEntriesService } from './time-entries.service';
import {
  ChecklistsController,
  SubtasksController,
  TaskExtrasController,
} from './task-extras.controller';
import { TaskExtrasService } from './task-extras.service';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
  ],
  controllers: [
    NotificationsController,
    CalendarController,
    RecurringTasksController,
    TimeEntriesController,
    KanbanController,
    ReportsController,
    ActivityLogsController,
    TaskExtrasController,
    SubtasksController,
    ChecklistsController,
  ],
  providers: [
    NotificationsService,
    WhatsappService,
    CalendarService,
    RecurringTasksService,
    TimeEntriesService,
    KanbanService,
    ReportsService,
    ActivityLogsService,
    TaskExtrasService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
  exports: [
    NotificationsService,
    WhatsappService,
    CalendarService,
    RecurringTasksService,
    TimeEntriesService,
    KanbanService,
    ReportsService,
    ActivityLogsService,
    TaskExtrasService,
  ],
})
export class NotificationsModule {}
