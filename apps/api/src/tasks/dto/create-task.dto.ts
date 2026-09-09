import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Priority } from '../../generated/prisma/enums';

export class CreateTaskDto {
  @IsString()
  @MaxLength(250)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @IsString()
  @MaxLength(100)
  clientId!: string;

  @IsString()
  @MaxLength(100)
  projectId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  statusId?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  estimatedHours?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  internalNotes?: string;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @IsOptional()
  @IsBoolean()
  isCritical?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyAssignee?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  primaryAssigneeId?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  assigneeIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  collaboratorIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  reviewerIds?: string[];
}
