import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CampaignCloseType, CampaignCommercialStatus, CampaignLocationLevel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  CampaignEligibilityDto,
  CampaignMerchantAdhesionDto,
  CampaignProcessorCodeDto,
} from './create-campaign.dto';

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  campaignTypeConfigId?: string;

  @IsOptional()
  @IsEnum(CampaignCloseType)
  closeType?: CampaignCloseType;

  @IsOptional()
  @IsEnum(CampaignCommercialStatus)
  commercialStatus?: CampaignCommercialStatus;

  @IsOptional()
  @IsString()
  codigoInterno?: string;

  @IsOptional()
  @IsString()
  codigoExterno?: string;

  @IsOptional()
  @IsDateString()
  fechaVigDesde?: string;

  @IsOptional()
  @IsDateString()
  fechaVigHasta?: string;

  @IsOptional()
  @IsDateString()
  fechaCierre?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dias?: string[];

  @IsOptional()
  @IsBoolean()
  tienePrioridad?: boolean;

  @IsOptional()
  @IsDateString()
  fechaPrioridad?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  paymentMethodIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  retailerIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branchIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  shoppingIds?: string[];

  @IsOptional()
  @IsBoolean()
  targetAllShoppings?: boolean;

  @IsOptional()
  @IsEnum(CampaignLocationLevel)
  locationLevel?: CampaignLocationLevel;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locationValues?: string[];

  @IsOptional()
  condiciones?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignProcessorCodeDto)
  processorCodes?: CampaignProcessorCodeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignMerchantAdhesionDto)
  adhesiones?: CampaignMerchantAdhesionDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignEligibilityDto)
  eligibility?: CampaignEligibilityDto;
}
