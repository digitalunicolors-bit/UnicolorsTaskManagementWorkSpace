import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class TimeEntryQueryDto {
  @IsOptional()
  @IsDateString()
  start?: string;

  @IsOptional()
  @IsDateString()
  end?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  employeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  projectId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  taskId?: string;
}
