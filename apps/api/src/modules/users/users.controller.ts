import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.BANK_ADMIN)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  async list(
    @CurrentUser() user: { tenantId: string; role: Role },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    return this.usersService.list(resolvedTenantId);
  }

  @Get(':id')
  async get(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; role: Role },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    return this.usersService.get(resolvedTenantId, id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: { tenantId: string; userId: string; role: Role },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    return this.usersService.update(resolvedTenantId, id, dto, user.userId, user.role);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; userId: string; role: Role },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    return this.usersService.deactivate(resolvedTenantId, id, user.userId);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { tenantId: string; userId: string; role: Role },
    @Query('bankId') bankId?: string,
  ) {
    const resolvedTenantId = user.role === Role.SUPERADMIN && bankId ? bankId : user.tenantId;
    return this.usersService.importCsv(resolvedTenantId, file.buffer, user.userId);
  }
}
