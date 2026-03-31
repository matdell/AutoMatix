import { IsBoolean } from 'class-validator';

export class TwoFactorEmailDto {
  @IsBoolean()
  enabled: boolean;
}
