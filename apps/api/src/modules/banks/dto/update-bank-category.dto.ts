import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateBankCategoryDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
