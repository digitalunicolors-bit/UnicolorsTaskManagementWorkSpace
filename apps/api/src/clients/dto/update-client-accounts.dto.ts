import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateClientAccountsDto {
  @IsIn([
    'QUOTATION_PREPARED',
    'AWAITING_CLIENT_CONFIRMATION',
    'READY_FOR_CLIENT_SERVICING',
    'HANDED_TO_CLIENT_SERVICING',
  ])
  stage!: string;
@IsOptional()
  @IsNumber()
  @Min(0)
  quotationAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  quotationDetails?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  billingDetails?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
