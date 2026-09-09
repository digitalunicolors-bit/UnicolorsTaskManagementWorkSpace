import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { RecurrenceFrequency } from '../../generated/prisma/enums';

export class CreateRecurringTaskDto {
  @IsString()
  templateTaskId!: string;

  @IsEnum(RecurrenceFrequency)
  frequency!: RecurrenceFrequency;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  interval?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays?: number[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth?: number;

  @IsString()
  startAt!: string;

  @IsOptional()
  @IsString()
  endAt?: string;

  @IsOptional()
  @IsString()
  recurrenceRule?: string;
}

export class UpdateRecurringTaskDto {
  @IsOptional()
  @IsEnum(RecurrenceFrequency)
  frequency?: RecurrenceFrequency;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  interval?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays?: number[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth?: number;

  @IsOptional()
  @IsString()
  startAt?: string;

  @IsOptional()
  @IsString()
  endAt?: string;

  @IsOptional()
  @IsString()
  recurrenceRule?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
