import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ManageClientApprovalDto {
  @IsIn(['APPROVE', 'UNAPPROVE', 'DISCUSS'])
  action!: 'APPROVE' | 'UNAPPROVE' | 'DISCUSS';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
