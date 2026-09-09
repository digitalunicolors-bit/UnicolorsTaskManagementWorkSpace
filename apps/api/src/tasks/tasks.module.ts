import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    AuthModule,
    NotificationsModule,
  ],
  

  controllers: [
    TasksController,
  ],

  providers: [
    TasksService,
  ],

  exports: [
    TasksService,
  ],
  
})
export class TasksModule {}