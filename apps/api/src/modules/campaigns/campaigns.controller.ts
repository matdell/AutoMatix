import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CampaignStatus, Role } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CampaignFormGenerationService } from './campaign-form-generation.service';

@Controller('campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.BANK_ADMIN, Role.BANK_OPS)
export class CampaignsController {
  constructor(
    private campaignsService: CampaignsService,
    private campaignFormGenerationService: CampaignFormGenerationService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: { tenantId: string },
    @Query('estado') estado?: CampaignStatus,
    @Query('includeArchived') includeArchived?: string,
    @Query('q') q?: string,
  ) {
    return this.campaignsService.list(user.tenantId, {
      estado,
      includeArchived: includeArchived === 'true',
      q,
    });
  }

  @Post()
  async create(
    @Body() dto: CreateCampaignDto,
    @CurrentUser() user: { tenantId: string; userId: string },
  ) {
    return this.campaignsService.create(user.tenantId, dto, user.userId);
  }

  @Get('export/csv')
  async exportCsv(@CurrentUser() user: { tenantId: string }) {
    return this.campaignsService.exportCsv(user.tenantId);
  }

  @Get(':id/generated-forms')
  async generatedForms(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string },
    @Query('merchantId') merchantId?: string,
  ) {
    return this.campaignFormGenerationService.listByCampaign(user.tenantId, id, merchantId);
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser() user: { tenantId: string }) {
    return this.campaignsService.get(user.tenantId, id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
    @CurrentUser() user: { tenantId: string; userId: string },
  ) {
    return this.campaignsService.update(user.tenantId, id, dto, user.userId);
  }

  @Post(':id/archive')
  async archive(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; userId: string },
  ) {
    return this.campaignsService.archive(user.tenantId, id, user.userId);
  }

  @Post(':id/submit')
  async submit(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; userId: string },
  ) {
    return this.campaignsService.transition(user.tenantId, id, CampaignStatus.PENDING, user.userId);
  }

  @Post(':id/activate')
  async activate(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; userId: string },
  ) {
    return this.campaignsService.transition(user.tenantId, id, CampaignStatus.ACTIVE, user.userId);
  }

  @Post(':id/reopen')
  async reopen(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; userId: string },
  ) {
    return this.campaignsService.transition(user.tenantId, id, CampaignStatus.EDITING, user.userId);
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; userId: string },
  ) {
    return this.campaignsService.transition(user.tenantId, id, CampaignStatus.CANCELLED, user.userId);
  }

  @Post(':id/restore')
  async restore(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; userId: string },
  ) {
    return this.campaignsService.restore(user.tenantId, id, user.userId);
  }
}
