import { IsOptional, IsString } from 'class-validator';

export class RunValidationDto {
  @IsOptional()
  @IsString()
  merchantId?: string;
}
