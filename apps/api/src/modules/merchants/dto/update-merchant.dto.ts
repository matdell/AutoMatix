import { IsArray, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { MerchantStatus } from '@prisma/client';

export class UpdateMerchantDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsEnum(MerchantStatus)
  estado?: MerchantStatus;

  @IsOptional()
  @IsString()
  cuit?: string;

  @IsOptional()
  @IsString()
  merchantNumber?: string;

  @IsOptional()
  @IsEmail()
  contactoEmail?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  brandIds?: string[];
}
