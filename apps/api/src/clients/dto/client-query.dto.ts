import {
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export class ClientQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn([
    'LEAD',
    'ACTIVE',
    'ON_HOLD',
    'INACTIVE',
    'COMPLETED',
  ])
  status?: string;

  @IsOptional()
  @IsIn([
    'DRAFT',
    'TERMS_SHARED',
    'AWAITING_CLIENT_APPROVAL',
    'APPROVED',
    'REJECTED',
    'FOLLOW_UP',
  ])
  onboardingStage?: string;

  @IsOptional()
  @IsString()
  accountManagerId?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  isActive?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsIn([
    'name',
    'companyName',
    'createdAt',
  ])
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: string;
}