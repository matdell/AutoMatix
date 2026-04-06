import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateBankBinConfigDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{6,10}$/)
  bin?: string;

  @IsOptional()
  @IsString()
  network?: string;

  @IsOptional()
  @IsString()
  cardType?: string;

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
