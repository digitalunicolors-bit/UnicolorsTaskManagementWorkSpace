import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateProjectMilestoneDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsIn([
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'MISSED',
    'CANCELLED',
  ])
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}