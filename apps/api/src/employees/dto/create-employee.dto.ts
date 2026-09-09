import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  employeeId!: string;

  @IsString()
  fullName!: string;

  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^@?[A-Za-z0-9._-]{3,30}$/, {
    message:
      'Username can only contain letters, numbers, dot, underscore and hyphen.',
  })
  username?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @MinLength(8)
  temporaryPassword!: string;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsString()
  @IsOptional()
  profileImageUrl?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  reportingManagerId?: string;

  @IsString()
  @IsOptional()
  joiningDate?: string;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional()
  skills?: string[];

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional()
  roleNames?: string[];
}