import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class DepartmentPersonDto {
  @IsString()
  @IsOptional()
  employeeId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  fullName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^@?[A-Za-z0-9._-]{3,30}$/, {
    message:
      'Username can only contain letters, numbers, dot, underscore and hyphen.',
  })
  username?: string;

  @IsString()
  @IsOptional()
  @MinLength(8)
  @MaxLength(128)
  temporaryPassword?: string;
}
