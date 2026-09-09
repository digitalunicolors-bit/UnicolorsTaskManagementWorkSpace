import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import {
  CreateRecurringTaskDto,
  UpdateRecurringTaskDto,
} from './dto/recurring-task.dto';
import { RecurringTasksService } from './recurring-tasks.service';

@ApiTags('Recurring Tasks')
@ApiBearerAuth()
@Controller('recurring-tasks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RecurringTasksController {
  constructor(private readonly recurringTasksService: RecurringTasksService) {}

  private userId(request: any) {
    const id = request?.user?.id ?? request?.user?.sub;
    if (!id) throw new UnauthorizedException();
    return String(id);
  }

  @Get()
  @Permissions('tasks.view')
  list(@Req() request: any) {
    return this.recurringTasksService.list(this.userId(request));
  }

  @Get('options/templates')
  @Permissions('tasks.create')
  options(@Req() request: any) {
    return this.recurringTasksService.templateOptions(this.userId(request));
  }

  @Post()
  @Permissions('tasks.create')
  create(@Req() request: any, @Body() dto: CreateRecurringTaskDto) {
    return this.recurringTasksService.create(this.userId(request), dto);
  }

  @Patch(':id')
  @Permissions('tasks.update')
  update(
    @Req() request: any,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringTaskDto,
  ) {
    return this.recurringTasksService.update(this.userId(request), id, dto);
  }

  @Delete(':id')
  @Permissions('tasks.delete')
  remove(@Req() request: any, @Param('id') id: string) {
    return this.recurringTasksService.remove(this.userId(request), id);
  }

  @Post(':id/run-now')
  @Permissions('tasks.create')
  runNow(@Req() request: any, @Param('id') id: string) {
    return this.recurringTasksService.runNow(this.userId(request), id);
  }

  @Post('system/process-due')
  @Permissions('tasks.view_all')
  processDue() {
    return this.recurringTasksService.processDueRules();
  }
}
