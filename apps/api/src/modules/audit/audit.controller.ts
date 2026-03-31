import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.BANK_ADMIN, Role.BANK_OPS)
export class AuditController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(
    @CurrentUser() user: { tenantId: string },
    @Query('entity') entity?: string,
    @Query('limit') limit?: string,
  ) {
    const take = limit ? Number(limit) : 50;
    return this.prisma.auditLog.findMany({
      where: {
        tenantId: user.tenantId,
        entity: entity || undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: Number.isFinite(take) ? take : 50,
    });
  }
}
