import { IsArray, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { MerchantStatus } from '@prisma/client';

export class UpdateMerchantDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  razonSocial?: string;

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
  direccionSocial?: string;

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
  @IsString()
  processor?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  brandIds?: string[];
}
