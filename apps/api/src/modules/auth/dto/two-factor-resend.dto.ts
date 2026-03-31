import { IsNotEmpty, IsString } from 'class-validator';

export class TwoFactorResendDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
