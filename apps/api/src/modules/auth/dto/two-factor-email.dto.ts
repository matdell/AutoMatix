import { IsBoolean } from 'class-validator';
import { TwoFactorReauthDto } from './two-factor-reauth.dto';

export class TwoFactorEmailDto extends TwoFactorReauthDto {
  @IsBoolean()
  enabled: boolean;
}
