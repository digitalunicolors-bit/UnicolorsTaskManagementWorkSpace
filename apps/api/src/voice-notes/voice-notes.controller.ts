import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

import {
  VoiceNotesService,
  type UploadedVoiceFile,
} from './voice-notes.service';
import { UpdateVoiceTranscriptDto } from './dto/update-voice-transcript.dto';

@ApiTags('Voice Notes')
@ApiBearerAuth()
@Controller('voice-notes')
@UseGuards(
  JwtAuthGuard,
  PermissionsGuard,
)
export class VoiceNotesController {
  constructor(
    private readonly voiceNotesService: VoiceNotesService,
  ) {}

  private getUserId(
    request: any,
  ) {
    const userId =
      request?.user?.id ??
      request?.user?.sub;

    if (!userId) {
      throw new UnauthorizedException();
    }

    return String(userId);
  }

  @Get('task/:taskId')
  @Permissions('tasks.view')
  findTaskVoiceNotes(
    @Param('taskId')
    taskId: string,
    @Req()
    request: any,
  ) {
    return this.voiceNotesService.findTaskVoiceNotes(
      taskId,
      this.getUserId(
        request,
      ),
    );
  }

  @Post('task/:taskId')
  @Permissions('files.upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize:
          VoiceNotesService.MAX_FILE_SIZE,
        files: 1,
      },
    }),
  )
  uploadTaskVoiceNote(
    @Param('taskId')
    taskId: string,
    @UploadedFile()
    file:
      | UploadedVoiceFile
      | undefined,
    @Body('durationSeconds')
    durationSeconds:
      | string
      | undefined,
    @Body('language')
    language:
      | string
      | undefined,
    @Req()
    request: any,
  ) {
    return this.voiceNotesService.uploadTaskVoiceNote(
      taskId,
      this.getUserId(
        request,
      ),
      file as UploadedVoiceFile,
      durationSeconds,
      language,
    );
  }

  @Post('preview-transcribe')
  @Permissions('files.upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize:
          VoiceNotesService.MAX_FILE_SIZE,
        files: 1,
      },
    }),
  )
  previewTranscription(
    @UploadedFile()
    file:
      | UploadedVoiceFile
      | undefined,
    @Body('language')
    language:
      | string
      | undefined,
  ) {
    return this.voiceNotesService.previewTranscription(
      file as UploadedVoiceFile,
      language,
    );
  }

  @Get(':id/content')
  @Permissions('files.download')
  async getVoiceContent(
    @Param('id')
    id: string,
    @Req()
    request: any,
    @Res()
    response: Response,
  ) {
    const result =
      await this.voiceNotesService.getVoiceContent(
        id,
        this.getUserId(
          request,
        ),
      );

    const filename =
      encodeURIComponent(
        result.note
          .originalName ||
          'voice-note',
      );

    response.setHeader(
      'Content-Type',
      result.note.mimeType ||
        'application/octet-stream',
    );

    response.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${filename}`,
    );

    if (
      result.note.sizeBytes !==
        null &&
      result.note.sizeBytes !==
        undefined
    ) {
      response.setHeader(
        'Content-Length',
        String(
          result.note.sizeBytes,
        ),
      );
    }

    result.stream.pipe(
      response,
    );
  }

  @Post(':id/transcribe')
  @Permissions('files.upload')
  retryTranscription(
    @Param('id')
    id: string,
    @Req()
    request: any,
  ) {
    return this.voiceNotesService.retryTranscription(
      id,
      this.getUserId(
        request,
      ),
    );
  }

  @Patch(':id/transcript')
  @Permissions('files.upload')
  updateTranscript(
    @Param('id')
    id: string,
    @Body()
    dto: UpdateVoiceTranscriptDto,
    @Req()
    request: any,
  ) {
    return this.voiceNotesService.updateTranscript(
      id,
      this.getUserId(
        request,
      ),
      dto,
    );
  }

  @Delete(':id')
  @Permissions('files.upload')
  deleteVoiceNote(
    @Param('id')
    id: string,
    @Req()
    request: any,
  ) {
    return this.voiceNotesService.deleteVoiceNote(
      id,
      this.getUserId(
        request,
      ),
    );
  }
}
