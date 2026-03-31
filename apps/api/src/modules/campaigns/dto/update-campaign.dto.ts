import { IsArray, IsDateString, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CampaignStatus, CampaignType } from '@prisma/client';
import { Type } from 'class-transformer';

class CampaignTargetDto {
  @IsString()
  merchantId: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsEnum(CampaignType)
  tipo?: CampaignType;

  @IsOptional()
  @IsEnum(CampaignStatus)
  estado?: CampaignStatus;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  condiciones?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignTargetDto)
  targets?: CampaignTargetDto[];
}
