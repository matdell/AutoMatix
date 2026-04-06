import { CampaignBenefitType, CampaignTargetMode } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateBankCampaignTypeConfigDto {
  @IsString()
  nombre: string;

  @IsEnum(CampaignBenefitType)
  benefitType: CampaignBenefitType;

  @IsEnum(CampaignTargetMode)
  mode: CampaignTargetMode;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
