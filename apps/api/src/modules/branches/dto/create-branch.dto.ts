import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  direccion: string;

  @IsOptional()
  @IsString()
  calle?: string;

  @IsOptional()
  @IsString()
  numero?: string;

  @IsOptional()
  @IsString()
  piso?: string;

  @IsOptional()
  @IsString()
  codigoPostal?: string;

  @IsString()
  @IsNotEmpty()
  ciudad: string;

  @IsString()
  @IsNotEmpty()
  provincia: string;

  @IsString()
  @IsNotEmpty()
  pais: string;

  @IsOptional()
  @IsString()
  placeId?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  merchantNumber?: string;

  @IsOptional()
  @IsString()
  processor?: string;

  @IsOptional()
  @IsString()
  shoppingId?: string;

  @IsString()
  @IsNotEmpty()
  retailerId: string;
}
