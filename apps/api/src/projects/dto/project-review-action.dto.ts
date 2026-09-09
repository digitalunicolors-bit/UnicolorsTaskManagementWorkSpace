import {
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ProjectReviewActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;
}

export class ProjectClientChangesDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  note!: string;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  departmentIds!: string[];
}
