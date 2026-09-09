import {
  IsDateString,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateHrJoinRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  role!: string;

  @IsString()
  @MinLength(1)
  departmentId!: string;

  @IsDateString()
  joinDate!: string;
}
