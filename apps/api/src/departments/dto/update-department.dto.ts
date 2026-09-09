import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DepartmentPersonDto } from './department-person.dto';

export class UpdateDepartmentDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ValidateNested()
  @Type(() => DepartmentPersonDto)
  @IsOptional()
  head?: DepartmentPersonDto | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartmentPersonDto)
  @IsOptional()
  members?: DepartmentPersonDto[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
