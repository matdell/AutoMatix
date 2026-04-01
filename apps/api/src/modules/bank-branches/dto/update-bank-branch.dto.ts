import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateBankBranchDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  codigo?: string;

  @IsOptional()
  @IsString()
  localidad?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

