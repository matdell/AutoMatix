import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateBankProcessorConfigDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
