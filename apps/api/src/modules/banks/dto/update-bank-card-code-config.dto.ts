import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateBankCardCodeConfigDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
