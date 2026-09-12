import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
} from 'class-validator';

import { Priority } from '../../generated/prisma/enums';

export class TaskQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

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
  @IsString()
  @MaxLength(100)
  assigneeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  createdById?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true'
      ? true
      : value === 'false'
        ? false
        : value,
  )
  @IsBoolean()
  mine?: boolean;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true'
      ? true
      : value === 'false'
        ? false
        : value,
  )
  @IsBoolean()
  overdue?: boolean;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true'
      ? true
      : value === 'false'
        ? false
        : value,
  )
  @IsBoolean()
  isDraft?: boolean;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true'
      ? true
      : value === 'false'
        ? false
        : value,
  )
  @IsBoolean()
  isCritical?: boolean;

  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @IsOptional()
  @IsDateString()
  dueTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @IsOptional()
  @IsIn([
    'title',
    'createdAt',
    'updatedAt',
    'dueAt',
    'startDate',
    'priority',
  ])
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}