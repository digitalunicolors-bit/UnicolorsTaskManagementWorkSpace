import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateSubtaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsOptional()
  @IsString()
  assignedEmployeeId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateSubtaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsOptional()
  @IsString()
  assignedEmployeeId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateChecklistItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateChecklistItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CompleteWorkItemDto {
  @IsBoolean()
  isCompleted!: boolean;
}

export class ReplaceTaskTagsDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  names!: string[];
}

export class ReplaceTaskDependenciesDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  taskIds!: string[];

  @IsOptional()
  @IsIn([
    'FINISH_TO_START',
    'START_TO_START',
    'FINISH_TO_FINISH',
    'START_TO_FINISH',
  ])
  type?:
    | 'FINISH_TO_START'
    | 'START_TO_START'
    | 'FINISH_TO_FINISH'
    | 'START_TO_FINISH';
}

export class SetupTaskStructureDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateSubtaskDto)
  subtasks?: CreateSubtaskDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateChecklistItemDto)
  checklist?: CreateChecklistItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  tagNames?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  dependencyIds?: string[];
}
