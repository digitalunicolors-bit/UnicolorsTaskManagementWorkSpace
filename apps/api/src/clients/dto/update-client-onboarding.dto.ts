import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateClientOnboardingDto {
  @IsIn([
    'TERMS_SHARED',
    'AWAITING_CLIENT_APPROVAL',
    'APPROVED',
    'REJECTED',
    'FOLLOW_UP',
  ])
  stage!: string;

  @IsOptional()
  @IsString()
  requirements?: string;

  @IsOptional()
  @IsString()
  termsConditions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
