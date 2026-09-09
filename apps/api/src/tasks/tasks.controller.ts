import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AddTaskAssigneesDto } from './dto/add-task-assignees.dto';
import { AddTaskCollaboratorsDto } from './dto/add-task-collaborators.dto';
import { AddTaskReviewersDto } from './dto/add-task-reviewers.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { RemoveTaskPeopleDto } from './dto/remove-task-people.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { TaskWorkflowActionDto } from './dto/task-workflow-action.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

type AuthenticatedRequest = Request & {
  user?: {
    sub?: string;
    id?: string;
    userId?: string;
  };
};

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  private getUserId(request: AuthenticatedRequest): string {
    const userId =
      request.user?.sub ?? request.user?.id ?? request.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('Authenticated user id not found.');
    }

    return userId;
  }

  @Get('meta/options')
  @Permissions('tasks.view')
  getMeta() {
    return this.tasksService.getMeta();
  }

  @Get('meta/reviewer-options')
  @Permissions('tasks.view')
  getReviewerOptions(
    @Query('projectId') projectId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tasksService.getReviewerOptions(
      this.getUserId(request),
      projectId?.trim() || undefined,
    );
  }

  @Get()
  @Permissions('tasks.view')
  findAll(@Query() query: TaskQueryDto, @Req() request: AuthenticatedRequest) {
    return this.tasksService.findAll(query, this.getUserId(request));
  }

  @Get(':id')
  @Permissions('tasks.view')
  findOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.tasksService.findOneForUser(id, this.getUserId(request));
  }

  @Post()
  @Permissions('tasks.create')
  create(@Body() dto: CreateTaskDto, @Req() request: AuthenticatedRequest) {
    return this.tasksService.create(dto, this.getUserId(request));
  }

  @Patch(':id')
  @Permissions('tasks.update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tasksService.update(id, dto, this.getUserId(request));
  }

  @Post(':id/submit-review')
  @Permissions('tasks.update')
  submitForReview(
    @Param('id') id: string,
    @Body() dto: TaskWorkflowActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tasksService.submitForReview(
      id,
      this.getUserId(request),
      dto,
    );
  }

  @Post(':id/request-changes')
  @Permissions('tasks.review')
  requestChanges(
    @Param('id') id: string,
    @Body() dto: TaskWorkflowActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tasksService.requestChanges(
      id,
      this.getUserId(request),
      dto,
    );
  }

  @Post(':id/resume-work')
  @Permissions('tasks.update')
  resumeAfterChanges(
    @Param('id') id: string,
    @Body() dto: TaskWorkflowActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tasksService.resumeAfterChanges(
      id,
      this.getUserId(request),
      dto,
    );
  }

  @Post(':id/approve')
  @Permissions('tasks.approve')
  approveTask(
    @Param('id') id: string,
    @Body() dto: TaskWorkflowActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tasksService.approveTask(id, this.getUserId(request), dto);
  }

  @Delete(':id')
  @Permissions('tasks.delete')
  remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.tasksService.remove(id, this.getUserId(request));
  }

  @Post(':id/assignees')
  @Permissions('tasks.assign')
  addAssignees(
    @Param('id') id: string,
    @Body() dto: AddTaskAssigneesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tasksService.addAssignees(
      id,
      dto,
      this.getUserId(request),
    );
  }

  @Delete(':id/assignees')
  @Permissions('tasks.assign')
  removeAssignees(
    @Param('id') id: string,
    @Body() dto: RemoveTaskPeopleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tasksService.removeAssignees(
      id,
      dto,
      this.getUserId(request),
    );
  }

  @Post(':id/collaborators')
  @Permissions('tasks.assign')
  addCollaborators(
    @Param('id') id: string,
    @Body() dto: AddTaskCollaboratorsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tasksService.addCollaborators(
      id,
      dto,
      this.getUserId(request),
    );
  }

  @Delete(':id/collaborators')
  @Permissions('tasks.assign')
  removeCollaborators(
    @Param('id') id: string,
    @Body() dto: RemoveTaskPeopleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tasksService.removeCollaborators(
      id,
      dto,
      this.getUserId(request),
    );
  }

  @Post(':id/reviewers')
  @Permissions('tasks.assign')
  addReviewers(
    @Param('id') id: string,
    @Body() dto: AddTaskReviewersDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tasksService.addReviewers(
      id,
      dto,
      this.getUserId(request),
    );
  }

  @Delete(':id/reviewers')
  @Permissions('tasks.assign')
  removeReviewers(
    @Param('id') id: string,
    @Body() dto: RemoveTaskPeopleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tasksService.removeReviewers(
      id,
      dto,
      this.getUserId(request),
    );
  }
}
