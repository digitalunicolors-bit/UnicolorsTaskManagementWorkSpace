import {
  IsDateString,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateHrEmployeeRecordDto {
  @IsString()
  @MaxLength(120)
  role!: string;

  @IsDateString()
  joinDate!: string;
}
