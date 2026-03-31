import { ArrayMaxSize, IsArray, IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateBankDto {
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
}
