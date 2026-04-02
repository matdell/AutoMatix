import { IsNotEmpty, IsString } from 'class-validator';

export class RunValidationDto {
  @IsString()
  @IsNotEmpty()
  merchantId: string;
}
