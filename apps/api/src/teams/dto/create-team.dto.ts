import {
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTeamDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  departmentId!: string;

  @IsString()
  @IsOptional()
  leadId?: string;

  @IsArray()
  @ArrayUnique()
  @IsString({
    each: true,
  })
  @IsOptional()
  memberIds?: string[];
}