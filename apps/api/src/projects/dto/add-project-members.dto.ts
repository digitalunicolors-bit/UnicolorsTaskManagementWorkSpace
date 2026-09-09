import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
} from 'class-validator';

export class AddProjectMembersDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  employeeIds!: string[];

  @IsOptional()
  @IsString()
  memberRole?: string;
}