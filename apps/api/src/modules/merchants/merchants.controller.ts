import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { MerchantsService } from './merchants.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role, MerchantStatus } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('merchants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MerchantsController {
  constructor(private merchantsService: MerchantsService) {}

  @Get()
  @Roles(Role.BANK_ADMIN, Role.BANK_OPS, Role.MERCHANT_ADMIN, Role.MERCHANT_USER, Role.BANK_BRANCH_MANAGER)
  async list(
    @CurrentUser() user: { tenantId: string; role: Role; merchantId?: string },
    @Query('estado') estado?: MerchantStatus,
    @Query('categoria') categoria?: string,
  ) {
    if ((user.role === Role.MERCHANT_ADMIN || user.role === Role.MERCHANT_USER || user.role === Role.MERCHANT) && user.merchantId) {
      return [await this.merchantsService.get(user.tenantId, user.merchantId)];
    }
    return this.merchantsService.list(user.tenantId, { estado, categoria });
  }

  @Post()
  @Roles(Role.BANK_ADMIN, Role.BANK_OPS)
  async create(
    @Body() dto: CreateMerchantDto,
    @CurrentUser() user: { tenantId: string; userId: string },
  ) {
    return this.merchantsService.create(user.tenantId, dto, user.userId);
  }

  @Get('export/csv')
  @Roles(Role.BANK_ADMIN, Role.BANK_OPS)
  async exportCsv(@CurrentUser() user: { tenantId: string }) {
    return this.merchantsService.exportCsv(user.tenantId);
  }

  @Get(':id')
  @Roles(Role.BANK_ADMIN, Role.BANK_OPS, Role.MERCHANT_ADMIN, Role.MERCHANT_USER)
  async get(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; role: Role; merchantId?: string },
  ) {
    if ((user.role === Role.MERCHANT_ADMIN || user.role === Role.MERCHANT_USER || user.role === Role.MERCHANT) && user.merchantId && user.merchantId !== id) {
      return this.merchantsService.get(user.tenantId, user.merchantId);
    }
    return this.merchantsService.get(user.tenantId, id);
  }

  @Put(':id')
  @Roles(Role.BANK_ADMIN, Role.BANK_OPS)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMerchantDto,
    @CurrentUser() user: { tenantId: string; userId: string },
  ) {
    return this.merchantsService.update(user.tenantId, id, dto, user.userId);
  }

  @Delete(':id')
  @Roles(Role.BANK_ADMIN)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; userId: string },
  ) {
    return this.merchantsService.remove(user.tenantId, id, user.userId);
  }

  @Post('import')
  @Roles(Role.BANK_ADMIN, Role.BANK_OPS)
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { tenantId: string; userId: string },
  ) {
    return this.merchantsService.importCsv(user.tenantId, file.buffer, user.userId);
  }
}
