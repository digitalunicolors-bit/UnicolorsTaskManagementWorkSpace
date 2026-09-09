import {
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateProjectMemberDto {
  @IsOptional()
  @IsString()
  memberRole?: string;
}