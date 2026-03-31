import { IsOptional, IsString } from 'class-validator';

export class PullSyncDto {
  @IsString()
  entity!: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  bankId?: string;
}
