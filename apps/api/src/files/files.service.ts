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
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import {
  FileAccessScope,
  FilePurpose,
  NotificationKind,
} from '../generated/prisma/enums';
import type { TaskFilePurpose } from './dto/upload-task-file.dto';

export interface UploadedTaskFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class FilesService {
  static readonly MAX_FILE_SIZE = 50 * 1024 * 1024;

  private readonly storageRoot = join(
    process.cwd(),
    'storage',
    'task-files',
  );

  private readonly allowedExtensions = new Set([
    '.png', '.jpg', '.jpeg', '.webp', '.gif',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.ppt', '.pptx', '.txt', '.csv', '.zip',
    '.mp4', '.webm', '.mov',
    '.ogg', '.mp3', '.wav', '.m4a', '.aac',
  ]);


  private readonly safeMimeByExtension: Record<string, string[]> = {
    '.png': ['image/png'],
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.webp': ['image/webp'],
    '.gif': ['image/gif'],
    '.pdf': ['application/pdf'],
    '.doc': ['application/msword', 'application/octet-stream'],
    '.docx': [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
      'application/octet-stream',
    ],
    '.xls': ['application/vnd.ms-excel', 'application/octet-stream'],
    '.xlsx': [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
      'application/octet-stream',
    ],
    '.ppt': ['application/vnd.ms-powerpoint', 'application/octet-stream'],
    '.pptx': [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip',
      'application/octet-stream',
    ],
    '.txt': ['text/plain', 'application/octet-stream'],
    '.csv': ['text/csv', 'text/plain', 'application/vnd.ms-excel', 'application/octet-stream'],
    '.zip': ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
    '.mp4': ['video/mp4', 'audio/mp4', 'application/octet-stream'],
    '.webm': ['video/webm', 'audio/webm', 'application/octet-stream'],
    '.mov': ['video/quicktime', 'application/octet-stream'],
    '.ogg': ['audio/ogg', 'application/ogg', 'application/octet-stream'],
    '.mp3': ['audio/mpeg', 'audio/mp3', 'application/octet-stream'],
    '.wav': ['audio/wav', 'audio/x-wav', 'application/octet-stream'],
    '.m4a': ['audio/mp4', 'audio/x-m4a', 'application/octet-stream'],
    '.aac': ['audio/aac', 'application/octet-stream'],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
  ) {
    mkdirSync(this.storageRoot, { recursive: true });
  }

  private async hasPermission(userId: string, code: string) {
    return Boolean(
      await this.prisma.userRole.findFirst({
        where: {
          userId,
          role: {
            isActive: true,
            permissions: {
              some: { permission: { code } },
            },
          },
        },
        select: { id: true },
      }),
    );
  }

  private hasMagic(file: UploadedTaskFile, extension: string) {
    const buffer = file.buffer;
    const hex = buffer.subarray(0, 16).toString('hex').toLowerCase();

    if (extension === '.png') return hex.startsWith('89504e470d0a1a0a');
    if (extension === '.jpg' || extension === '.jpeg') return hex.startsWith('ffd8ff');
    if (extension === '.gif') return buffer.subarray(0, 6).toString('ascii').match(/^GIF8[79]a$/) !== null;
    if (extension === '.pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    if (extension === '.webp') {
      return (
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    }
    if (['.zip', '.docx', '.xlsx', '.pptx'].includes(extension)) {
      return hex.startsWith('504b0304') || hex.startsWith('504b0506') || hex.startsWith('504b0708');
    }
    if (['.doc', '.xls', '.ppt'].includes(extension)) {
      return hex.startsWith('d0cf11e0a1b11ae1');
    }

    return true;
  }

  private validateUpload(file?: UploadedTaskFile) {
    if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException('Please choose a valid file.');
    }

    if (file.size <= 0 || file.size > FilesService.MAX_FILE_SIZE) {
      throw new BadRequestException('File size must be between 1 byte and 50 MB.');
    }

    const extension = extname(file.originalname).toLowerCase();
    if (!this.allowedExtensions.has(extension)) {
      throw new BadRequestException(
        'Unsupported file type. Allowed: images, documents, archives, common video files and common audio files.',
      );
    }

    const allowedMimes = this.safeMimeByExtension[extension] ?? [];
    const mime = (file.mimetype || 'application/octet-stream').toLowerCase();

    if (!allowedMimes.includes(mime)) {
      throw new BadRequestException('File content type does not match its extension.');
    }

    if (!this.hasMagic(file, extension)) {
      throw new BadRequestException('File signature does not match its extension.');
    }

    return extension;
  }

  private cleanName(value: string) {
    return (
      value
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .replace(/[\\/]/g, '_')
        .trim()
        .slice(0, 240) || 'file'
    );
  }

  private normalizePurpose(purpose?: TaskFilePurpose) {
    if (purpose === FilePurpose.REFERENCE) return FilePurpose.REFERENCE;
    if (purpose === FilePurpose.WORK_SUBMISSION) {
      return FilePurpose.WORK_SUBMISSION;
    }
    return FilePurpose.GENERAL;
  }

  private absolutePath(storageKey: string) {
    const absolute = resolve(this.storageRoot, storageKey);
    const rel = relative(this.storageRoot, absolute);

    if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
      throw new BadRequestException('Invalid file path.');
    }

    return absolute;
  }

  private safeMimeType(originalName: string) {
    const extension = extname(originalName).toLowerCase();
    const preferred: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain; charset=utf-8',
      '.csv': 'text/csv; charset=utf-8',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.ogg': 'audio/ogg',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
    };

    return preferred[extension] ?? 'application/octet-stream';
  }

  private serialize(file: any) {
    return {
      ...file,
      sizeBytes: Number(file.sizeBytes ?? 0),
    };
  }

  private readonly includeFile = {
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

  private async actorName(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        email: true,
        phone: true,
        employeeProfile: {
          select: { fullName: true, username: true },
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

  private async assertProjectExists(
    projectId: string,
  ) {
    const project =
      await this.prisma.project.findFirst({
        where: {
          id: projectId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
        },
      });

    if (!project) {
      throw new NotFoundException(
        'Project not found.',
      );
    }

    return project;
  }

  private async taskRecipients(taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        title: true,
        createdById: true,
        assignees: {
          where: { removedAt: null },
          select: { employee: { select: { userId: true } } },
        },
        collaborators: {
          where: { removedAt: null },
          select: { employee: { select: { userId: true } } },
        },
        reviewers: {
          select: { employee: { select: { userId: true } } },
        },
        followers: {
          select: { employee: { select: { userId: true } } },
        },
      },
    });

    if (!task) throw new NotFoundException('Task not found.');

    const recipients = new Set<string>([
      task.createdById,
      ...task.assignees.map((x) => x.employee.userId),
      ...task.collaborators.map((x) => x.employee.userId),
      ...task.reviewers.map((x) => x.employee.userId),
      ...task.followers.map((x) => x.employee.userId),
    ]);

    return { task, recipients: [...recipients] };
  }

  private async notifyFileUpload(
    userIds: string[],
    actorId: string,
    taskId: string,
    title: string,
    message: string,
  ) {
    const ids = [
      ...new Set(userIds.filter((id) => id && id !== actorId)),
    ];
    if (!ids.length) return;

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: ids },
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        notificationPreference: {
          select: { inAppEnabled: true, fileUploaded: true },
        },
      },
    });

    const allowed = users.filter((user) => {
      const pref = user.notificationPreference;
      return pref?.inAppEnabled !== false && pref?.fileUploaded !== false;
    });

    if (!allowed.length) return;

    await this.prisma.notification.createMany({
      data: allowed.map((user) => ({
        userId: user.id,
        actorId,
        kind: NotificationKind.FILE_UPLOADED,
        title,
        message,
        entityType: 'TASK',
        entityId: taskId,
        redirectPath: `/tasks?task=${taskId}`,
      })),
    });
  }

  async findTaskFiles(taskId: string, userId: string) {
    await this.tasksService.findOneForUser(taskId, userId);

    const files = await this.prisma.fileAsset.findMany({
      where: { taskId, deletedAt: null },
      include: this.includeFile,
      orderBy: { createdAt: 'desc' },
    });

    return files.map((file) => this.serialize(file));
  }

  async uploadTaskFile(
    taskId: string,
    userId: string,
    file: UploadedTaskFile,
    purpose?: TaskFilePurpose,
  ) {
    await this.tasksService.findOneForUser(taskId, userId);
    const extension = this.validateUpload(file);
    const originalName = this.cleanName(file.originalname);
    const taskDirectory = join(this.storageRoot, taskId);
    mkdirSync(taskDirectory, { recursive: true });

    const storedName = `${randomUUID()}${extension}`;
    const storageKey = `${taskId}/${storedName}`;
    const absolute = this.absolutePath(storageKey);
    writeFileSync(absolute, file.buffer, { flag: 'wx' });

    let created: any;
    try {
      created = await this.prisma.fileAsset.create({
        data: {
          originalName,
          storageKey,
          mimeType: this.safeMimeType(originalName),
          extension: extension.slice(1),
          sizeBytes: BigInt(file.size),
          uploadedById: userId,
          taskId,
          purpose: this.normalizePurpose(purpose),
          accessScope: FileAccessScope.INHERITED,
        },
        include: this.includeFile,
      });
    } catch (error) {
      if (existsSync(absolute)) unlinkSync(absolute);
      throw error;
    }

    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'FILE_UPLOADED',
        entityType: 'TASK',
        entityId: taskId,
        metadata: {
          fileId: created.id,
          originalName,
          purpose: created.purpose,
          sizeBytes: file.size,
        },
      },
    });

    const { task, recipients } = await this.taskRecipients(taskId);
    const name = await this.actorName(userId);
    await this.notifyFileUpload(
      recipients,
      userId,
      taskId,
      created.purpose === FilePurpose.WORK_SUBMISSION
        ? 'Work submitted'
        : 'New task file',
      `${name} uploaded "${originalName}" to "${task.title}".`,
    );

    return this.serialize(created);
  }

  async findProjectFiles(
    projectId: string,
    userId: string,
  ) {
    await this.assertProjectExists(
      projectId,
    );

    const files =
      await this.prisma.fileAsset.findMany({
        where: {
          projectId,
          deletedAt: null,
        },
        include: this.includeFile,
        orderBy: {
          createdAt: 'desc',
        },
      });

    return files.map((file) =>
      this.serialize(file),
    );
  }

  async uploadProjectFile(
    projectId: string,
    userId: string,
    file: UploadedTaskFile,
    purpose?: TaskFilePurpose,
  ) {
    const project =
      await this.assertProjectExists(
        projectId,
      );

    const extension =
      this.validateUpload(file);

    const originalName =
      this.cleanName(
        file.originalname,
      );

    const projectDirectory =
      join(
        this.storageRoot,
        'projects',
        projectId,
      );

    mkdirSync(
      projectDirectory,
      {
        recursive: true,
      },
    );

    const storedName =
      `${randomUUID()}${extension}`;

    const storageKey =
      `projects/${projectId}/${storedName}`;

    const absolute =
      this.absolutePath(
        storageKey,
      );

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
        await this.prisma.fileAsset.create({
          data: {
            originalName,
            storageKey,
            mimeType:
              file.mimetype ||
              this.safeMimeType(
                originalName,
              ),
            extension:
              extension.slice(1),
            sizeBytes:
              BigInt(file.size),
            uploadedById:
              userId,
            projectId,
            purpose:
              this.normalizePurpose(
                purpose,
              ),
            accessScope:
              FileAccessScope.INHERITED,
          },
          include:
            this.includeFile,
        });
    } catch (error) {
      if (
        existsSync(absolute)
      ) {
        unlinkSync(absolute);
      }

      throw error;
    }

    await this.prisma.activityLog.create({
      data: {
        userId,
        action:
          'FILE_UPLOADED',
        entityType:
          'PROJECT',
        entityId:
          projectId,
        metadata: {
          fileId:
            created.id,
          originalName,
          purpose:
            created.purpose,
          sizeBytes:
            file.size,
        },
      },
    });

    return {
      ...this.serialize(created),
      projectName:
        project.name,
    };
  }

  private async getFileForUser(
    fileId: string,
    userId: string,
    download = false,
  ) {
    const file = await this.prisma.fileAsset.findFirst({
      where: { id: fileId, deletedAt: null },
      include: this.includeFile,
    });

    if (!file) {
      throw new NotFoundException(
        'File not found.',
      );
    }

    if (file.taskId) {
      await this.tasksService.findOneForUser(
        file.taskId,
        userId,
      );
    } else if (file.projectId) {
      await this.assertProjectExists(
        file.projectId,
      );
    } else {
      throw new BadRequestException(
        'This file is not linked to a supported workspace record.',
      );
    }

    if (
      file.accessScope === FileAccessScope.RESTRICTED &&
      file.uploadedById !== userId
    ) {
      const canManage = await this.hasPermission(userId, 'files.manage');
      if (!canManage) {
        const grant = await this.prisma.fileAccessGrant.findFirst({
          where: {
            fileId,
            userId,
            ...(download ? { canDownload: true } : { canView: true }),
          },
          select: { id: true },
        });
        if (!grant) {
          throw new ForbiddenException(
            'You do not have access to this file.',
          );
        }
      }
    }

    return file;
  }

  async getFileContent(fileId: string, userId: string) {
    const file = await this.getFileForUser(fileId, userId, true);
    const absolutePath = this.absolutePath(file.storageKey);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('Stored file is missing.');
    }

    return {
      file: this.serialize(file),
      contentType:
        file.mimeType ||
        this.safeMimeType(
          file.originalName,
        ),
      stream: createReadStream(absolutePath),
    };
  }

  async deleteFile(fileId: string, userId: string) {
    const file = await this.getFileForUser(fileId, userId);
    const canManage = await this.hasPermission(userId, 'files.manage');

    if (file.uploadedById !== userId && !canManage) {
      throw new ForbiddenException(
        'You can only delete files that you uploaded.',
      );
    }

    await this.prisma.fileAsset.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    });

    const absolute = this.absolutePath(file.storageKey);
    if (existsSync(absolute)) {
      try { unlinkSync(absolute); } catch {}
    }

    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'FILE_DELETED',
        entityType:
          file.taskId
            ? 'TASK'
            : 'PROJECT',
        entityId:
          file.taskId ??
          file.projectId ??
          file.id,
        metadata: {
          fileId,
          originalName:
            file.originalName,
        },
      },
    });

    return { success: true };
  }
}
