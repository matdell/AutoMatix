import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
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

@Controller('banks')
export class BanksController {
  constructor(private banksService: BanksService, private storage: StorageService) {}

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
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogoById(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { userId: string },
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Debes adjuntar un archivo de logo.');
    }
    const upload = await this.storage.upload({
      tenantId: id,
      buffer: file.buffer,
      contentType: file.mimetype,
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
  async me(@CurrentUser() user: { tenantId: string }) {
    return this.banksService.getCurrent(user.tenantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN)
  @Put('me')
  async update(
    @Body() dto: UpdateBankDto,
    @CurrentUser() user: { tenantId: string; userId: string },
  ) {
    return this.banksService.updateCurrent(user.tenantId, dto, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BANK_ADMIN)
  @Post('me/logo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { tenantId: string; userId: string },
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Debes adjuntar un archivo de logo.');
    }
    const upload = await this.storage.upload({
      tenantId: user.tenantId,
      buffer: file.buffer,
      contentType: file.mimetype,
      filename: file.originalname,
      prefix: 'logos',
    });
    return this.banksService.updateCurrent(
      user.tenantId,
      { logoUrl: upload.url },
      user.userId,
    );
  }
}
