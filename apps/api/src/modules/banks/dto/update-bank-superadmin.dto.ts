import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateBankSuperadminDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  nombreCompleto?: string;

  @IsOptional()
  @IsString()
  razonSocial?: string;

  @IsOptional()
  @IsString()
  cuit?: string;

  @IsOptional()
  @IsString()
  direccionCasaMatriz?: string;

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
  @IsDateString()
  fechaAlta?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
