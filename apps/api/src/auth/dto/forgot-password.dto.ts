import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  identifier!: string;
}
