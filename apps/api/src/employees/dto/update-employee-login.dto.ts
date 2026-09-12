import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateEmployeeLoginDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
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
  temporaryPassword?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
