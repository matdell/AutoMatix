import { CardNetwork } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class BranchEstablishmentInputDto {
  @IsEnum(CardNetwork)
  cardNetwork: CardNetwork;

  @IsString()
  @IsNotEmpty()
  number: string;
}
