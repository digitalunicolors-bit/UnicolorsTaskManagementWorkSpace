import {
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export class ProjectQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

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
  @IsIn([
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT',
  ])
  priority?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsIn([
    'name',
    'createdAt',
    'deadline',
    'startDate',
  ])
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: string;
}