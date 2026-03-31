import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class TwoFactorVerifyDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsIn(['email', 'totp'])
  method: 'email' | 'totp';
}
