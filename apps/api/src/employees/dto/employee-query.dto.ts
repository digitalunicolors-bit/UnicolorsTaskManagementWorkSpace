import {
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export class EmployeeQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsIn([
    'ACTIVE',
    'INACTIVE',
    'RESIGNED',
  ])
  @IsOptional()
  employmentStatus?:
    | 'ACTIVE'
    | 'INACTIVE'
    | 'RESIGNED';
}