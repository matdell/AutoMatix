import { CardNetwork } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateBankCardCodeConfigDto {
  @IsEnum(CardNetwork)
  network: CardNetwork;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
