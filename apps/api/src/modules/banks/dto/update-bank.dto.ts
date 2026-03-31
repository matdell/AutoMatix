import { ArrayMaxSize, IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateBankDto {
  @IsOptional()
  @IsString()
  nombre?: string;

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
}
