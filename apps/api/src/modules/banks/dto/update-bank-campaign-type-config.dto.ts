import { CampaignBenefitType, CampaignTargetMode } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateBankCampaignTypeConfigDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsEnum(CampaignBenefitType)
  benefitType?: CampaignBenefitType;

  @IsOptional()
  @IsEnum(CampaignTargetMode)
  mode?: CampaignTargetMode;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
