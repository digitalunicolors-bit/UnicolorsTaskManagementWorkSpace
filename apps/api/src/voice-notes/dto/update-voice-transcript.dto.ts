import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateVoiceTranscriptDto {
  @IsString()
  @MaxLength(20000)
  transcript!: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  language?: string;
}
