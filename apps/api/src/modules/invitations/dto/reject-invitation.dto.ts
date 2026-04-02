import { IsEmail } from 'class-validator';

export class RejectInvitationDto {
  @IsEmail()
  email: string;
}
