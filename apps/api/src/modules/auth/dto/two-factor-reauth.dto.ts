import { IsOptional, IsString, MinLength } from 'class-validator';

export class TwoFactorReauthDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  currentPassword?: string;

  @IsOptional()
  @IsString()
  totpCode?: string;
}
