import {
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsBoolean()
  @IsOptional()
  inAppEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  emailEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  whatsappEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  taskAssigned?: boolean;

  @IsBoolean()
  @IsOptional()
  taskReassigned?: boolean;

  @IsBoolean()
  @IsOptional()
  dueReminder?: boolean;

  @IsBoolean()
  @IsOptional()
  upcomingDeadline?: boolean;

  @IsBoolean()
  @IsOptional()
  overdueTask?: boolean;

  @IsBoolean()
  @IsOptional()
  commentAdded?: boolean;

  @IsBoolean()
  @IsOptional()
  userMentioned?: boolean;

  @IsBoolean()
  @IsOptional()
  fileUploaded?: boolean;

  @IsBoolean()
  @IsOptional()
  reviewUpdates?: boolean;

  @IsBoolean()
  @IsOptional()
  taskCompleted?: boolean;

  @IsBoolean()
  @IsOptional()
  projectDeadline?: boolean;

  @IsBoolean()
  @IsOptional()
  dailyDigestEnabled?: boolean;
}
