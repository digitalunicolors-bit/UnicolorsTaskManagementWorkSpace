import { IsIn, IsOptional } from 'class-validator';

export const TASK_FILE_PURPOSES = [
  'GENERAL',
  'REFERENCE',
  'WORK_SUBMISSION',
] as const;

export type TaskFilePurpose =
  (typeof TASK_FILE_PURPOSES)[number];

export class UploadTaskFileDto {
  @IsIn(TASK_FILE_PURPOSES)
  @IsOptional()
  purpose?: TaskFilePurpose;
}
