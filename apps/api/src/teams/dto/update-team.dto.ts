import {
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateTeamDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  leadId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}