import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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

import { MoveKanbanTaskDto } from './dto/move-kanban-task.dto';
import { KanbanService } from './kanban.service';

@ApiTags('Kanban')
@ApiBearerAuth()
@Controller('kanban')
@UseGuards(
  JwtAuthGuard,
  PermissionsGuard,
)
export class KanbanController {
  constructor(
    private readonly kanbanService: KanbanService,
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

  @Get('options')
  @Permissions('tasks.view')
  options(
    @Req()
    request: any,
  ) {
    return this.kanbanService.options(
      this.userId(request),
    );
  }

  @Get('board')
  @Permissions('tasks.view')
  board(
    @Req()
    request: any,
    @Query('search')
    search?: string,
    @Query('clientId')
    clientId?: string,
    @Query('projectId')
    projectId?: string,
    @Query('assigneeId')
    assigneeId?: string,
    @Query('priority')
    priority?: string,
  ) {
    return this.kanbanService.board(
      this.userId(request),
      {
        search,
        clientId,
        projectId,
        assigneeId,
        priority,
      },
    );
  }

  @Patch(':id/reopen')
  @Permissions('tasks.update')
  reopen(
    @Req()
    request: any,
    @Param('id')
    id: string,
  ) {
    return this.kanbanService.reopen(
      this.userId(request),
      id,
    );
  }

  @Patch(':id/move')
  @Permissions('tasks.update')
  move(
    @Req()
    request: any,
    @Param('id')
    id: string,
    @Body()
    dto: MoveKanbanTaskDto,
  ) {
    return this.kanbanService.move(
      this.userId(request),
      id,
      dto,
    );
  }
}
