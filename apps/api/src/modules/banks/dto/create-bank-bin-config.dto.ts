import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class CreateBankBinConfigDto {
  @IsString()
  @Matches(/^\d{6,10}$/)
  bin: string;

  @IsString()
  network: string;

  @IsString()
  cardType: string;

  @IsOptional()
  @IsString()
  segment?: string;

  @IsOptional()
  @IsString()
  alliance?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  product?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
