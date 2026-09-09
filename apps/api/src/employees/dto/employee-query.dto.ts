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
    'ON_LEAVE',
    'INACTIVE',
    'RESIGNED',
  ])
  @IsOptional()
  employmentStatus?:
    | 'ACTIVE'
    | 'ON_LEAVE'
    | 'INACTIVE'
    | 'RESIGNED';
}