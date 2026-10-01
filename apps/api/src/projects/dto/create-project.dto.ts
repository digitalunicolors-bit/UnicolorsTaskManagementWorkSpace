import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  clientId!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  departmentIds?: string[];

  // Backward compatibility for older callers.
  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  deadline?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsIn([
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT',
  ])
  priority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  internalNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  voiceTranscript?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  voiceLanguage?: string;

  // Kept for compatibility with existing project APIs.
  @IsOptional()
  @IsString()
  projectManagerId?: string;

  @IsOptional()
  @IsIn([
    'PLANNING',
    'ACTIVE',
    'ON_HOLD',
    'UNDER_REVIEW',
    'COMPLETED',
    'CANCELLED',
    'ARCHIVED',
  ])
  status?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  memberIds?: string[];
}
