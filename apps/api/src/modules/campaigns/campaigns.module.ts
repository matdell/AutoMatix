import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { AuditModule } from '../audit/audit.module';
import { CampaignFormGenerationService } from './campaign-form-generation.service';

@Module({
  imports: [AuditModule],
  providers: [CampaignsService, CampaignFormGenerationService],
  controllers: [CampaignsController],
  exports: [CampaignFormGenerationService],
})
export class CampaignsModule {}
