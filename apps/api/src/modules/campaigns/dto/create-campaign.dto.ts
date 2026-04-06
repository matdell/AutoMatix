import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  CampaignAdhesionStatus,
  CampaignCloseType,
  CampaignCommercialStatus,
  CampaignLocationLevel,
} from '@prisma/client';
import { Type } from 'class-transformer';

export class CampaignProcessorCodeDto {
  @IsString()
  @IsNotEmpty()
  processor: string;

  @IsString()
  @IsNotEmpty()
  code: string;
}

export class CampaignMerchantAdhesionDto {
  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @IsEnum(CampaignAdhesionStatus)
  status: CampaignAdhesionStatus;
}

export class CampaignEligibilityDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  network?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cardType?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  segment?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alliance?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channel?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  product?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  binesFinalesOverride?: string[];
}

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  campaignTypeConfigId: string;

  @IsEnum(CampaignCloseType)
  closeType: CampaignCloseType;

  @IsOptional()
  @IsEnum(CampaignCommercialStatus)
  commercialStatus?: CampaignCommercialStatus;

  @IsOptional()
  @IsString()
  codigoInterno?: string;

  @IsOptional()
  @IsString()
  codigoExterno?: string;

  @IsDateString()
  fechaVigDesde: string;

  @IsDateString()
  fechaVigHasta: string;

  @IsOptional()
  @IsDateString()
  fechaCierre?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  dias: string[];

  @IsOptional()
  @IsBoolean()
  tienePrioridad?: boolean;

  @IsOptional()
  @IsDateString()
  fechaPrioridad?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  paymentMethodIds: string[];

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
