import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UploadTaskFileDto } from './dto/upload-task-file.dto';
import { FilesService, type UploadedTaskFile } from './files.service';

@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  private userId(request: any) {
    const value = request?.user?.id ?? request?.user?.sub;
    if (!value) throw new UnauthorizedException();
    return String(value);
  }

  @Get('task/:taskId')
  @Permissions('tasks.view')
  findTaskFiles(@Param('taskId') taskId: string, @Req() request: any) {
    return this.filesService.findTaskFiles(taskId, this.userId(request));
  }

  @Get('project/:projectId')
  @Permissions('projects.view')
  findProjectFiles(
    @Param('projectId')
    projectId: string,
    @Req()
    request: any,
  ) {
    return this.filesService.findProjectFiles(
      projectId,
      this.userId(request),
    );
  }

  @Post('project/:projectId')
  @Permissions('files.upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: FilesService.MAX_FILE_SIZE,
        files: 1,
        fields: 5,
      },
    }),
  )
  uploadProjectFile(
    @Param('projectId')
    projectId: string,
    @UploadedFile()
    file: UploadedTaskFile,
    @Body()
    dto: UploadTaskFileDto,
    @Req()
    request: any,
  ) {
    return this.filesService.uploadProjectFile(
      projectId,
      this.userId(request),
      file,
      dto.purpose,
    );
  }

  @Post('task/:taskId')
  @Permissions('files.upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: FilesService.MAX_FILE_SIZE,
        files: 1,
        fields: 5,
      },
    }),
  )
  uploadTaskFile(
    @Param('taskId') taskId: string,
    @UploadedFile() file: UploadedTaskFile,
    @Body() dto: UploadTaskFileDto,
    @Req() request: any,
  ) {
    return this.filesService.uploadTaskFile(
      taskId,
      this.userId(request),
      file,
      dto.purpose,
    );
  }

  @Get(':id/content')
  @Permissions('files.download')
  async getFileContent(
    @Param('id') id: string,
    @Query('download') download: string | undefined,
    @Req() request: any,
    @Res() response: Response,
  ) {
    const result = await this.filesService.getFileContent(
      id,
      this.userId(request),
    );

    const inlineAllowed =
      result.contentType.startsWith('image/') ||
      result.contentType.startsWith('video/') ||
      result.contentType === 'application/pdf';

    const disposition = download === '1' || !inlineAllowed ? 'attachment' : 'inline';

    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Content-Type', result.contentType);
    response.setHeader(
      'Content-Disposition',
      `${disposition}; filename*=UTF-8''${encodeURIComponent(result.file.originalName)}`,
    );
    response.setHeader('Content-Length', String(result.file.sizeBytes));
    result.stream.pipe(response);
  }

  @Delete(':id')
  @Permissions('files.upload')
  deleteFile(@Param('id') id: string, @Req() request: any) {
    return this.filesService.deleteFile(id, this.userId(request));
  }
}
