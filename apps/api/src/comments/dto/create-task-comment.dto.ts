import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTaskCommentDto {
  @IsString()
  @MaxLength(5000)
  content!: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  mentionedUserIds?: string[];
}
