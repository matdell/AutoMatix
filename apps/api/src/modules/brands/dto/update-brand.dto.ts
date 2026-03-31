import { IsArray, IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateBrandDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  sitioWeb?: string;

  @IsOptional()
  @IsString()
  facebook?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  twitter?: string;

  @IsOptional()
  @IsEmail()
  emailPrincipal?: string;

  @IsOptional()
  @IsString()
  telefonoPrincipal?: string;

  @IsOptional()
  @IsString()
  processor?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rubros?: string[];

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
