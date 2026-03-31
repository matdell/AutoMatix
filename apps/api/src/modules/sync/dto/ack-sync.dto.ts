import { IsOptional, IsString } from 'class-validator';

export class AckSyncDto {
  @IsString()
  entity!: string;

  @IsString()
  batchId!: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  @IsString()
  bankId?: string;
}
