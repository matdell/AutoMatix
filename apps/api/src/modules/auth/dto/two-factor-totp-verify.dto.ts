import { IsNotEmpty, IsString } from 'class-validator';

export class TwoFactorTotpVerifyDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}
