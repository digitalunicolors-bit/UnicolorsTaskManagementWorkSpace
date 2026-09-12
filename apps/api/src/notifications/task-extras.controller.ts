import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import {
  CompleteWorkItemDto,
  CreateChecklistItemDto,
  CreateSubtaskDto,
  ReplaceTaskDependenciesDto,
  ReplaceTaskTagsDto,
  SetupTaskStructureDto,
  UpdateChecklistItemDto,
  UpdateSubtaskDto,
  UpdateSubtaskWorkflowDto,
} from './dto/task-extras.dto';
import { TaskExtrasService } from './task-extras.service';

function userId(request: any) {
  const value = request?.user?.id ?? request?.user?.sub;
  if (!value) throw new UnauthorizedException();
  return String(value);
}

@ApiTags('Task Extras')
@ApiBearerAuth()
@Controller('task-extras')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TaskExtrasController {
  constructor(private readonly service: TaskExtrasService) {}

  @Get('options')
  @Permissions('tasks.view')
  options(
    @Req() request: any,
    @Query('taskId') taskId?: string,
  ) {
    return this.service.options(userId(request), taskId);
  }

  @Get('task/:taskId')
  @Permissions('tasks.view')
  structure(
    @Req() request: any,
    @Param('taskId') taskId: string,
  ) {
    return this.service.structure(taskId, userId(request));
  }

  @Post('task/:taskId/setup')
  @Permissions('tasks.create')
  setup(
    @Req() request: any,
    @Param('taskId') taskId: string,
    @Body() dto: SetupTaskStructureDto,
  ) {
    return this.service.setupTask(taskId, userId(request), dto);
  }

  @Put('task/:taskId/tags')
  @Permissions('tasks.create')
  replaceTags(
    @Req() request: any,
    @Param('taskId') taskId: string,
    @Body() dto: ReplaceTaskTagsDto,
  ) {
    return this.service.replaceTags(taskId, userId(request), dto);
  }

  @Put('task/:taskId/dependencies')
  @Permissions('tasks.create')
  replaceDependencies(
    @Req() request: any,
    @Param('taskId') taskId: string,
    @Body() dto: ReplaceTaskDependenciesDto,
  ) {
    return this.service.replaceDependencies(
      taskId,
      userId(request),
      dto,
    );
  }
}

@ApiTags('Subtasks')
@ApiBearerAuth()
@Controller('subtasks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SubtasksController {
  constructor(private readonly service: TaskExtrasService) {}

  @Post('task/:taskId')
  @Permissions('tasks.create')
  create(
    @Req() request: any,
    @Param('taskId') taskId: string,
    @Body() dto: CreateSubtaskDto,
  ) {
    return this.service.createSubtask(taskId, userId(request), dto);
  }

  @Patch(':id')
  @Permissions('tasks.create')
  update(
    @Req() request: any,
    @Param('id') id: string,
    @Body() dto: UpdateSubtaskDto,
  ) {
    return this.service.updateSubtask(id, userId(request), dto);
  }

  @Get('task/:taskId/workflow')
  @Permissions('tasks.view')
  workflow(
    @Req() request: any,
    @Param('taskId') taskId: string,
  ) {
    return this.service.subtaskWorkflow(
      taskId,
      userId(request),
    );
  }

  @Patch(':id/workflow')
  @Permissions('tasks.update')
  updateWorkflow(
    @Req() request: any,
    @Param('id') id: string,
    @Body() dto: UpdateSubtaskWorkflowDto,
  ) {
    return this.service.updateSubtaskWorkflow(
      id,
      userId(request),
      dto,
    );
  }

  @Patch(':id/complete')
  @Permissions('tasks.update')
  complete(
    @Req() request: any,
    @Param('id') id: string,
    @Body() dto: CompleteWorkItemDto,
  ) {
    return this.service.completeSubtask(id, userId(request), dto);
  }

  @Delete(':id')
  @Permissions('tasks.create')
  remove(
    @Req() request: any,
    @Param('id') id: string,
  ) {
    return this.service.removeSubtask(id, userId(request));
  }
}

@ApiTags('Checklists')
@ApiBearerAuth()
@Controller('checklists')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChecklistsController {
  constructor(private readonly service: TaskExtrasService) {}

  @Post('task/:taskId')
  @Permissions('tasks.create')
  create(
    @Req() request: any,
    @Param('taskId') taskId: string,
    @Body() dto: CreateChecklistItemDto,
  ) {
    return this.service.createChecklist(taskId, userId(request), dto);
  }

  @Patch(':id')
  @Permissions('tasks.create')
  update(
    @Req() request: any,
    @Param('id') id: string,
    @Body() dto: UpdateChecklistItemDto,
  ) {
    return this.service.updateChecklist(id, userId(request), dto);
  }

  @Patch(':id/complete')
  @Permissions('tasks.update')
  complete(
    @Req() request: any,
    @Param('id') id: string,
    @Body() dto: CompleteWorkItemDto,
  ) {
    return this.service.completeChecklist(id, userId(request), dto);
  }

  @Delete(':id')
  @Permissions('tasks.create')
  remove(
    @Req() request: any,
    @Param('id') id: string,
  ) {
    return this.service.removeChecklist(id, userId(request));
  }
}
