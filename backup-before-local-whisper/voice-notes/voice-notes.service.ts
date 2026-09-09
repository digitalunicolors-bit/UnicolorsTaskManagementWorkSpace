import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  createReadStream,
  existsSync,
  mkdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import {
  extname,
  join,
  normalize,
} from 'node:path';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import {
  NotificationKind,
  TranscriptionStatus,
} from '../generated/prisma/enums';

import { UpdateVoiceTranscriptDto } from './dto/update-voice-transcript.dto';

export interface UploadedVoiceFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class VoiceNotesService {
  static readonly MAX_FILE_SIZE =
    20 * 1024 * 1024;

  static readonly MAX_DURATION_SECONDS =
    10 * 60;

  private readonly storageRoot =
    join(
      process.cwd(),
      'storage',
      'task-voice-notes',
    );

  private readonly allowedExtensions =
    new Set([
      '.webm',
      '.ogg',
      '.mp3',
      '.wav',
      '.m4a',
      '.mp4',
      '.aac',
    ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
  ) {
    mkdirSync(
      this.storageRoot,
      {
        recursive: true,
      },
    );
  }

  private async hasPermission(
    userId: string,
    permissionCode: string,
  ) {
    const result =
      await this.prisma.userRole.findFirst({
        where: {
          userId,
          role: {
            isActive: true,
            permissions: {
              some: {
                permission: {
                  code: permissionCode,
                },
              },
            },
          },
        },
        select: {
          id: true,
        },
      });

    return Boolean(result);
  }

  private cleanOriginalName(
    value?: string | null,
  ) {
    const fallback =
      `voice-note-${Date.now()}.webm`;

    if (!value) {
      return fallback;
    }

    const cleaned =
      value
        .replace(
          /[\u0000-\u001f\u007f]/g,
          '',
        )
        .replace(/[\\/]/g, '_')
        .trim()
        .slice(0, 240);

    return cleaned || fallback;
  }

  private validateUpload(
    file?: UploadedVoiceFile,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Please record or choose an audio file.',
      );
    }

    if (
      !file.buffer ||
      !Buffer.isBuffer(file.buffer)
    ) {
      throw new BadRequestException(
        'Invalid voice note upload.',
      );
    }

    if (
      file.size <= 0 ||
      file.size >
        VoiceNotesService.MAX_FILE_SIZE
    ) {
      throw new BadRequestException(
        'Voice note must be between 1 byte and 20 MB.',
      );
    }

    const extension =
      extname(
        file.originalname,
      ).toLowerCase();

    if (
      !this.allowedExtensions.has(
        extension,
      )
    ) {
      throw new BadRequestException(
        'Unsupported audio type. Use WEBM, OGG, MP3, WAV, M4A, MP4 or AAC.',
      );
    }

    if (
      file.mimetype &&
      !(
        file.mimetype.startsWith(
          'audio/',
        ) ||
        file.mimetype ===
          'video/webm' ||
        file.mimetype ===
          'video/mp4' ||
        file.mimetype ===
          'application/octet-stream'
      )
    ) {
      throw new BadRequestException(
        'The selected file is not a supported audio recording.',
      );
    }

    return extension;
  }

  private normalizeDuration(
    value?: number | string | null,
  ) {
    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      return null;
    }

    const parsed =
      Number(value);

    if (
      !Number.isFinite(parsed) ||
      parsed < 0
    ) {
      return null;
    }

    return Math.min(
      Math.round(parsed),
      VoiceNotesService.MAX_DURATION_SECONDS,
    );
  }

  private absolutePath(
    storageKey: string,
  ) {
    const safeKey =
      normalize(storageKey).replace(
        /^(\.\.(\/|\\|$))+/,
        '',
      );

    const absolute =
      join(
        this.storageRoot,
        safeKey,
      );

    if (
      !absolute.startsWith(
        this.storageRoot,
      )
    ) {
      throw new BadRequestException(
        'Invalid voice note path.',
      );
    }

    return absolute;
  }

  private serialize(
    voiceNote: any,
  ) {
    return {
      ...voiceNote,
      sizeBytes:
        voiceNote.sizeBytes ===
        null ||
        voiceNote.sizeBytes ===
        undefined
          ? null
          : typeof voiceNote.sizeBytes ===
              'bigint'
            ? Number(
                voiceNote.sizeBytes,
              )
            : Number(
                voiceNote.sizeBytes,
              ),
    };
  }

  private readonly voiceInclude = {
    uploadedBy: {
      select: {
        id: true,
        email: true,
        phone: true,
        employeeProfile: {
          select: {
            id: true,
            employeeId: true,
            username: true,
            fullName: true,
            designation: true,
            profileImageUrl: true,
          },
        },
      },
    },
  } as const;

  private async getActorName(
    userId: string,
  ) {
    const user =
      await this.prisma.user.findFirst({
        where: {
          id: userId,
          deletedAt: null,
        },
        select: {
          email: true,
          phone: true,
          employeeProfile: {
            select: {
              fullName: true,
              username: true,
            },
          },
        },
      });

    return (
      user?.employeeProfile?.fullName ||
      (user?.employeeProfile?.username
        ? `@${user.employeeProfile.username}`
        : null) ||
      user?.email ||
      user?.phone ||
      'A team member'
    );
  }

  private async getTaskParticipants(
    taskId: string,
  ) {
    const task =
      await this.prisma.task.findFirst({
        where: {
          id: taskId,
          deletedAt: null,
        },
        select: {
          id: true,
          title: true,
          createdById: true,
          assignees: {
            where: {
              removedAt: null,
            },
            select: {
              employee: {
                select: {
                  userId: true,
                },
              },
            },
          },
          collaborators: {
            where: {
              removedAt: null,
            },
            select: {
              employee: {
                select: {
                  userId: true,
                },
              },
            },
          },
          reviewers: {
            select: {
              employee: {
                select: {
                  userId: true,
                },
              },
            },
          },
          followers: {
            select: {
              employee: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      });

    if (!task) {
      throw new NotFoundException(
        'Task not found.',
      );
    }

    return {
      task,
      userIds: [
        ...new Set([
          task.createdById,
          ...task.assignees.map(
            (item) =>
              item.employee.userId,
          ),
          ...task.collaborators.map(
            (item) =>
              item.employee.userId,
          ),
          ...task.reviewers.map(
            (item) =>
              item.employee.userId,
          ),
          ...task.followers.map(
            (item) =>
              item.employee.userId,
          ),
        ]),
      ],
    };
  }

  private async notifyParticipants(
    taskId: string,
    actorId: string,
    originalName: string,
  ) {
    const {
      task,
      userIds,
    } =
      await this.getTaskParticipants(
        taskId,
      );

    const recipients =
      userIds.filter(
        (id) =>
          id &&
          id !== actorId,
      );

    if (!recipients.length) {
      return;
    }

    const users =
      await this.prisma.user.findMany({
        where: {
          id: {
            in: recipients,
          },
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
          notificationPreference: {
            select: {
              inAppEnabled: true,
              fileUploaded: true,
            },
          },
        },
      });

    const allowed =
      users.filter(
        (user) => {
          const pref =
            user.notificationPreference;

          if (
            pref?.inAppEnabled === false
          ) {
            return false;
          }

          if (
            pref?.fileUploaded === false
          ) {
            return false;
          }

          return true;
        },
      );

    if (!allowed.length) {
      return;
    }

    const actorName =
      await this.getActorName(actorId);

    await this.prisma.notification.createMany({
      data: allowed.map(
        (user) => ({
          userId: user.id,
          actorId,
          kind:
            NotificationKind.FILE_UPLOADED,
          title:
            'New voice note',
          message:
            `${actorName} added a voice note to "${task.title}".`,
          entityType: 'TASK',
          entityId: taskId,
          redirectPath:
            `/tasks?task=${taskId}`,
        }),
      ),
    });
  }

  async findTaskVoiceNotes(
    taskId: string,
    userId: string,
  ) {
    await this.tasksService.findOneForUser(
      taskId,
      userId,
    );

    const notes =
      await this.prisma.taskVoiceNote.findMany({
        where: {
          taskId,
          deletedAt: null,
        },
        include:
          this.voiceInclude,
        orderBy: {
          createdAt: 'desc',
        },
      });

    return notes.map(
      (note) =>
        this.serialize(note),
    );
  }

  async uploadTaskVoiceNote(
    taskId: string,
    userId: string,
    file: UploadedVoiceFile,
    durationSeconds?: number | string | null,
  ) {
    await this.tasksService.findOneForUser(
      taskId,
      userId,
    );

    const extension =
      this.validateUpload(file);

    const originalName =
      this.cleanOriginalName(
        file.originalname,
      );

    const taskDirectory =
      join(
        this.storageRoot,
        taskId,
      );

    mkdirSync(
      taskDirectory,
      {
        recursive: true,
      },
    );

    const storedName =
      `${randomUUID()}${extension}`;

    const storageKey =
      `${taskId}/${storedName}`;

    const absolute =
      this.absolutePath(storageKey);

    writeFileSync(
      absolute,
      file.buffer,
      {
        flag: 'wx',
      },
    );

    let created: any;

    try {
      created =
        await this.prisma.taskVoiceNote.create({
          data: {
            taskId,
            uploadedById:
              userId,
            originalName,
            storageKey,
            mimeType:
              file.mimetype ||
              'application/octet-stream',
            sizeBytes:
              BigInt(file.size),
            durationSeconds:
              this.normalizeDuration(
                durationSeconds,
              ),
            transcriptionStatus:
              TranscriptionStatus.PENDING,
          },
          include:
            this.voiceInclude,
        });
    } catch (error) {
      if (existsSync(absolute)) {
        unlinkSync(absolute);
      }

      throw error;
    }

    await this.prisma.activityLog.create({
      data: {
        userId,
        action:
          'VOICE_NOTE_UPLOADED',
        entityType: 'TASK',
        entityId: taskId,
        metadata: {
          voiceNoteId:
            created.id,
          originalName,
          sizeBytes:
            file.size,
          durationSeconds:
            created.durationSeconds,
        },
      },
    });

    try {
      await this.notifyParticipants(
        taskId,
        userId,
        originalName,
      );
    } catch {
      // Notification failure must not make a successful voice upload fail.
    }

    return this.serialize(
      created,
    );
  }

  private async getVoiceForUser(
    id: string,
    userId: string,
  ) {
    const note =
      await this.prisma.taskVoiceNote.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        include:
          this.voiceInclude,
      });

    if (!note) {
      throw new NotFoundException(
        'Voice note not found.',
      );
    }

    await this.tasksService.findOneForUser(
      note.taskId,
      userId,
    );

    return note;
  }

  async getVoiceContent(
    id: string,
    userId: string,
  ) {
    const note =
      await this.getVoiceForUser(
        id,
        userId,
      );

    const absolute =
      this.absolutePath(
        note.storageKey,
      );

    if (!existsSync(absolute)) {
      throw new NotFoundException(
        'Stored voice note is missing.',
      );
    }

    return {
      note:
        this.serialize(note),
      stream:
        createReadStream(
          absolute,
        ),
    };
  }

  async updateTranscript(
    id: string,
    userId: string,
    dto: UpdateVoiceTranscriptDto,
  ) {
    const note =
      await this.getVoiceForUser(
        id,
        userId,
      );

    const canManage =
      await this.hasPermission(
        userId,
        'files.manage',
      );

    if (
      note.uploadedById !==
        userId &&
      !canManage
    ) {
      throw new ForbiddenException(
        'You can only edit the transcript of your own voice note.',
      );
    }

    const transcript =
      dto.transcript.trim();

    const updated =
      await this.prisma.taskVoiceNote.update({
        where: {
          id,
        },
        data: {
          transcript:
            transcript || null,
          transcriptEditedAt:
            new Date(),
          transcriptionStatus:
            transcript
              ? TranscriptionStatus.COMPLETED
              : TranscriptionStatus.PENDING,
          language:
            dto.language?.trim() ||
            null,
          provider:
            transcript
              ? 'MANUAL'
              : null,
          errorMessage: null,
        },
        include:
          this.voiceInclude,
      });

    await this.prisma.activityLog.create({
      data: {
        userId,
        action:
          'VOICE_TRANSCRIPT_UPDATED',
        entityType: 'TASK',
        entityId: note.taskId,
        metadata: {
          voiceNoteId: id,
          provider:
            transcript
              ? 'MANUAL'
              : null,
        },
      },
    });

    return this.serialize(
      updated,
    );
  }

  async deleteVoiceNote(
    id: string,
    userId: string,
  ) {
    const note =
      await this.getVoiceForUser(
        id,
        userId,
      );

    const canManage =
      await this.hasPermission(
        userId,
        'files.manage',
      );

    if (
      note.uploadedById !==
        userId &&
      !canManage
    ) {
      throw new ForbiddenException(
        'You can only delete voice notes that you uploaded.',
      );
    }

    await this.prisma.taskVoiceNote.update({
      where: {
        id,
      },
      data: {
        deletedAt:
          new Date(),
      },
    });

    const absolute =
      this.absolutePath(
        note.storageKey,
      );

    if (existsSync(absolute)) {
      try {
        unlinkSync(absolute);
      } catch {
        // DB soft-delete is already complete.
      }
    }

    await this.prisma.activityLog.create({
      data: {
        userId,
        action:
          'VOICE_NOTE_DELETED',
        entityType: 'TASK',
        entityId: note.taskId,
        metadata: {
          voiceNoteId: id,
          originalName:
            note.originalName,
        },
      },
    });

    return {
      success: true,
    };
  }
}
