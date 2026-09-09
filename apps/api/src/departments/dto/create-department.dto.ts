import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DepartmentPersonDto } from './department-person.dto';

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ValidateNested()
  @Type(() => DepartmentPersonDto)
  @IsOptional()
  head?: DepartmentPersonDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartmentPersonDto)
  @IsOptional()
  members?: DepartmentPersonDto[];
}
