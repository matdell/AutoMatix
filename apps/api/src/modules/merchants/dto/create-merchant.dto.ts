import { IsArray, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { MerchantStatus } from '@prisma/client';

export class CreateMerchantDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  categoria: string;

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
