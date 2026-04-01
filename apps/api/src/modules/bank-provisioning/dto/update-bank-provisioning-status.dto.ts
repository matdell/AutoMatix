import { ProvisioningStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBankProvisioningStatusDto {
  @IsEnum(ProvisioningStatus)
  status: ProvisioningStatus;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  errorMessage?: string;
}

