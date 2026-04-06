import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateBankDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

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

  @IsString()
  @IsNotEmpty()
  slug: string;

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
  timezone?: string;

  @IsString()
  @IsNotEmpty()
  adminNombre: string;

  @IsEmail()
  adminEmail: string;

  @IsString()
  @MinLength(8)
  adminPassword: string;
}
