import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { BanksService } from './banks.service';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';
import { UpdateBankSuperadminDto } from './dto/update-bank-superadmin.dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from '../storage/storage.service';
import { ensureImageFile, FILE_INTERCEPTOR_OPTIONS } from '../common/upload-security';
import { CreateBankCardCodeConfigDto } from './dto/create-bank-card-code-config.dto';
import { UpdateBankCardCodeConfigDto } from './dto/update-bank-card-code-config.dto';
import { CreateBankCategoryDto } from './dto/create-bank-category.dto';
import { UpdateBankCategoryDto } from './dto/update-bank-category.dto';
import { CreateBankShoppingDto } from './dto/create-bank-shopping.dto';
import { UpdateBankShoppingDto } from './dto/update-bank-shopping.dto';
import { CreateBankProcessorConfigDto } from './dto/create-bank-processor-config.dto';
import { UpdateBankProcessorConfigDto } from './dto/update-bank-processor-config.dto';
import { CreateBankCampaignTypeConfigDto } from './dto/create-bank-campaign-type-config.dto';
import { UpdateBankCampaignTypeConfigDto } from './dto/update-bank-campaign-type-config.dto';
import { CreateBankBinConfigDto } from './dto/create-bank-bin-config.dto';
import { UpdateBankBinConfigDto } from './dto/update-bank-bin-config.dto';

@Controller('banks')
export class BanksController {
  constructor(private banksService: BanksService, private storage: StorageService) {}

  private resolveTenantId(user: { tenantId: string; role: Role }, bankId?: string) {
    if (user.role === Role.SUPERADMIN && bankId) {
      return bankId;
    }
    return user.tenantId;
  }

  private parseBoolean(value?: string) {
    if (!value) return false;
    return ['1', 'true', 'yes', 'si', 'on'].includes(value.trim().toLowerCase());
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  @Get()
  async list() {
    return this.banksService.list();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  @Post()
  async create(@Body() dto: CreateBankDto) {
    return this.banksService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  @Patch(':id')
  async updateById(
    @Param('id') id: string,
    @Body() dto: UpdateBankSuperadminDto,
    @CurrentUser() user: { userId: string },
  ) {
    return this.banksService.updateById(id, dto, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('file', FILE_INTERCEPTOR_OPTIONS))
  async uploadLogoById(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { userId: string },
  ) {
    const contentType = ensureImageFile(file);
    const upload = await this.storage.upload({
      tenantId: id,
      buffer: file.buffer,
      contentType,
      filename: file.originalname,
      prefix: 'logos',
    });
    return this.banksService.updateById(
      id,
      { logoUrl: upload.url },
      user.userId,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPERADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.banksService.remove(id, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(
    @CurrentUser() user: { tenantId: string; role: Role },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.getCurrent(resolvedTenantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.SUPERADMIN)
  @Put('me')
  async update(
    @Body() dto: UpdateBankDto,
    @CurrentUser() user: { tenantId: string; userId: string; role: Role },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.updateCurrent(resolvedTenantId, dto, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.SUPERADMIN)
  @Post('me/logo')
  @UseInterceptors(FileInterceptor('file', FILE_INTERCEPTOR_OPTIONS))
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { tenantId: string; userId: string; role: Role },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    const contentType = ensureImageFile(file);
    const upload = await this.storage.upload({
      tenantId: resolvedTenantId,
      buffer: file.buffer,
      contentType,
      filename: file.originalname,
      prefix: 'logos',
    });
    return this.banksService.updateCurrent(
      resolvedTenantId,
      { logoUrl: upload.url },
      user.userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/card-code-configs')
  async listCardCodeConfigs(
    @CurrentUser() user: { tenantId: string; role: Role },
    @Query('bankId') bankId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.listCardCodeConfigs(resolvedTenantId, {
      activeOnly: this.parseBoolean(activeOnly),
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/categories')
  async listCategories(
    @CurrentUser() user: { tenantId: string; role: Role },
    @Query('bankId') bankId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.listCategories(resolvedTenantId, {
      activeOnly: this.parseBoolean(activeOnly),
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.SUPERADMIN)
  @Post('me/categories')
  async createCategory(
    @Body() dto: CreateBankCategoryDto,
    @CurrentUser() user: { tenantId: string; role: Role; userId: string },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.createCategory(resolvedTenantId, dto, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.SUPERADMIN)
  @Patch('me/categories/:id')
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateBankCategoryDto,
    @CurrentUser() user: { tenantId: string; role: Role; userId: string },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.updateCategory(resolvedTenantId, id, dto, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.SUPERADMIN)
  @Delete('me/categories/:id')
  async removeCategory(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; role: Role; userId: string },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.removeCategory(resolvedTenantId, id, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/shoppings')
  async listShoppings(
    @CurrentUser() user: { tenantId: string; role: Role },
    @Query('bankId') bankId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.listShoppings(resolvedTenantId, {
      activeOnly: this.parseBoolean(activeOnly),
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.SUPERADMIN)
  @Post('me/shoppings')
  async createShopping(
    @Body() dto: CreateBankShoppingDto,
    @CurrentUser() user: { tenantId: string; role: Role; userId: string },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.createShopping(resolvedTenantId, dto, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.SUPERADMIN)
  @Patch('me/shoppings/:id')
  async updateShopping(
    @Param('id') id: string,
    @Body() dto: UpdateBankShoppingDto,
    @CurrentUser() user: { tenantId: string; role: Role; userId: string },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.updateShopping(resolvedTenantId, id, dto, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.SUPERADMIN)
  @Delete('me/shoppings/:id')
  async removeShopping(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; role: Role; userId: string },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.removeShopping(resolvedTenantId, id, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/processor-configs')
  async listProcessorConfigs(
    @CurrentUser() user: { tenantId: string; role: Role },
    @Query('bankId') bankId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.listProcessorConfigs(resolvedTenantId, {
      activeOnly: this.parseBoolean(activeOnly),
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.SUPERADMIN)
  @Post('me/processor-configs')
  async createProcessorConfig(
    @Body() dto: CreateBankProcessorConfigDto,
    @CurrentUser() user: { tenantId: string; role: Role; userId: string },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.createProcessorConfig(resolvedTenantId, dto, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.SUPERADMIN)
  @Patch('me/processor-configs/:id')
  async updateProcessorConfig(
    @Param('id') id: string,
    @Body() dto: UpdateBankProcessorConfigDto,
    @CurrentUser() user: { tenantId: string; role: Role; userId: string },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.updateProcessorConfig(resolvedTenantId, id, dto, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.SUPERADMIN)
  @Delete('me/processor-configs/:id')
  async removeProcessorConfig(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; role: Role; userId: string },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.removeProcessorConfig(resolvedTenantId, id, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/campaign-type-configs')
  async listCampaignTypeConfigs(
    @CurrentUser() user: { tenantId: string; role: Role },
    @Query('bankId') bankId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.listCampaignTypeConfigs(resolvedTenantId, {
      activeOnly: this.parseBoolean(activeOnly),
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.SUPERADMIN)
  @Post('me/campaign-type-configs')
  async createCampaignTypeConfig(
    @Body() dto: CreateBankCampaignTypeConfigDto,
    @CurrentUser() user: { tenantId: string; role: Role; userId: string },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.createCampaignTypeConfig(resolvedTenantId, dto, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.SUPERADMIN)
  @Patch('me/campaign-type-configs/:id')
  async updateCampaignTypeConfig(
    @Param('id') id: string,
    @Body() dto: UpdateBankCampaignTypeConfigDto,
    @CurrentUser() user: { tenantId: string; role: Role; userId: string },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.updateCampaignTypeConfig(resolvedTenantId, id, dto, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.SUPERADMIN)
  @Delete('me/campaign-type-configs/:id')
  async removeCampaignTypeConfig(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; role: Role; userId: string },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.removeCampaignTypeConfig(resolvedTenantId, id, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/bin-configs')
  async listBinConfigs(
    @CurrentUser() user: { tenantId: string; role: Role },
    @Query('bankId') bankId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.listBinConfigs(resolvedTenantId, {
      activeOnly: this.parseBoolean(activeOnly),
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.SUPERADMIN)
  @Post('me/bin-configs')
  async createBinConfig(
    @Body() dto: CreateBankBinConfigDto,
    @CurrentUser() user: { tenantId: string; role: Role; userId: string },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.createBinConfig(resolvedTenantId, dto, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.SUPERADMIN)
  @Patch('me/bin-configs/:id')
  async updateBinConfig(
    @Param('id') id: string,
    @Body() dto: UpdateBankBinConfigDto,
    @CurrentUser() user: { tenantId: string; role: Role; userId: string },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.updateBinConfig(resolvedTenantId, id, dto, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.SUPERADMIN)
  @Delete('me/bin-configs/:id')
  async removeBinConfig(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; role: Role; userId: string },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.removeBinConfig(resolvedTenantId, id, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.SUPERADMIN)
  @Post('me/card-code-configs')
  async createCardCodeConfig(
    @Body() dto: CreateBankCardCodeConfigDto,
    @CurrentUser() user: { tenantId: string; role: Role; userId: string },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.createCardCodeConfig(resolvedTenantId, dto, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.SUPERADMIN)
  @Patch('me/card-code-configs/:id')
  async updateCardCodeConfig(
    @Param('id') id: string,
    @Body() dto: UpdateBankCardCodeConfigDto,
    @CurrentUser() user: { tenantId: string; role: Role; userId: string },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.updateCardCodeConfig(resolvedTenantId, id, dto, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN, Role.SUPERADMIN)
  @Delete('me/card-code-configs/:id')
  async removeCardCodeConfig(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; role: Role; userId: string },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, bankId);
    return this.banksService.removeCardCodeConfig(resolvedTenantId, id, user.userId);
  }
}
