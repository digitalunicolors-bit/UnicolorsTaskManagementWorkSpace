import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsString()
  @MaxLength(150)
  companyName!: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  accountManagerId?: string;

  @IsOptional()
  @IsString()
  clientServicingId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deliverables?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  primaryContacts?: string[];

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
  @IsString()
  requirements?: string;

  @IsOptional()
  @IsObject()
  scopeCommitments?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  paymentRemark?: string;

  @IsOptional()
  @IsString()
  termsConditions?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
