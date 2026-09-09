import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class StartTimeEntryDto {
  @IsString()
  @MaxLength(100)
  projectId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  taskId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}

export class ManualTimeEntryDto {
  @IsString()
  @MaxLength(100)
  projectId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  taskId?: string;

  @IsDateString()
  workDate!: string;

  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes!: number;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}
