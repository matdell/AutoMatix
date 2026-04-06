import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateBankCategoryDto {
  @IsString()
  nombre: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
