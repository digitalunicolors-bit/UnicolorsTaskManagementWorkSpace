import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsString,
} from 'class-validator';

export class TeamMembersDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({
    each: true,
  })
  employeeIds!: string[];
}