import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';
import { PullSyncDto } from './dto/pull-sync.dto';
import { AckSyncDto } from './dto/ack-sync.dto';

@Controller('sync')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.BANK_ADMIN)
export class SyncController {
  constructor(private syncService: SyncService) {}

  @Post('pull')
  async pull(@Body() dto: PullSyncDto) {
    return this.syncService.pullBatch(dto.entity, dto.cursor, dto.bankId);
  }

  @Post('ack')
  async ack(@Body() dto: AckSyncDto) {
    return this.syncService.ackBatch(dto);
  }
}
