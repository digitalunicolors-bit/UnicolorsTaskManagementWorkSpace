import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSuperAdminDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^@?[A-Za-z0-9._-]{3,30}$/, {
    message:
      'Username can only contain letters, numbers, dot, underscore and hyphen.',
  })
  username!: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @MinLength(8)
  temporaryPassword!: string;
}
