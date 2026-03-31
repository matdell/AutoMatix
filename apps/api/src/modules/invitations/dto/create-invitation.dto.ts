import { IsArray, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsArray()
  branchIds?: string[];
}
