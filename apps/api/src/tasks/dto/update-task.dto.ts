import { Type } from 'class-transformer';
import {
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

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(250)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  projectId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  departmentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  statusId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  statusChangeReason?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsDateString()
  dueAt?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  estimatedHours?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  internalNotes?: string | null;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @IsOptional()
  @IsBoolean()
  isCritical?: boolean;
}
