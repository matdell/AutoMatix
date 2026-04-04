import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
