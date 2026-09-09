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

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CommentsService } from './comments.service';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@ApiTags('Comments')
@ApiBearerAuth()
@Controller('comments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
  ) {}

  private userId(request: any) {
    const value = request?.user?.id ?? request?.user?.sub;
    if (!value) throw new UnauthorizedException();
    return String(value);
  }

  @Get('task/:taskId')
  @Permissions('tasks.view')
  findTaskComments(
    @Param('taskId') taskId: string,
    @Req() request: any,
  ) {
    return this.commentsService.findTaskComments(
      taskId,
      this.userId(request),
    );
  }

  @Post('task/:taskId')
  @Permissions('comments.create')
  createTaskComment(
    @Param('taskId') taskId: string,
    @Body() dto: CreateTaskCommentDto,
    @Req() request: any,
  ) {
    return this.commentsService.createTaskComment(
      taskId,
      this.userId(request),
      dto,
    );
  }

  @Patch(':id')
  @Permissions('comments.create')
  updateComment(
    @Param('id') id: string,
    @Body() dto: UpdateCommentDto,
    @Req() request: any,
  ) {
    return this.commentsService.updateComment(
      id,
      this.userId(request),
      dto,
    );
  }

  @Delete(':id')
  @Permissions('comments.create')
  deleteComment(
    @Param('id') id: string,
    @Req() request: any,
  ) {
    return this.commentsService.deleteComment(
      id,
      this.userId(request),
    );
  }
}
