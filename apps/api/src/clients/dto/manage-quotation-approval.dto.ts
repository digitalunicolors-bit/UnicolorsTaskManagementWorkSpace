import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ManageQuotationApprovalDto {
  @IsIn(['APPROVE', 'UNAPPROVE'])
  action!: 'APPROVE' | 'UNAPPROVE';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
