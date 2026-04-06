import { Module } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CampaignsModule } from '../campaigns/campaigns.module';

@Module({
  imports: [AuditModule, NotificationsModule, CampaignsModule],
  providers: [InvitationsService],
  controllers: [InvitationsController],
})
export class InvitationsModule {}
