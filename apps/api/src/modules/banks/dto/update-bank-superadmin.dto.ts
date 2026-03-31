import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateBankSuperadminDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  paymentMethods?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  bines?: string[];

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
