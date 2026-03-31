import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CampaignType } from '@prisma/client';

class CampaignTargetDto {
  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsEnum(CampaignType)
  tipo: CampaignType;

  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFin: string;

  @IsOptional()
  condiciones?: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignTargetDto)
  targets: CampaignTargetDto[];
}
