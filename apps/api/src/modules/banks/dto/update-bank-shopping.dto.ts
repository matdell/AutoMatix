import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateBankShoppingDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  grupo?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
