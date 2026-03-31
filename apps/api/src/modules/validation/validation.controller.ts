import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ValidationService } from './validation.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator';
import { RunValidationDto } from './dto/run-validation.dto';

@Controller('validations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.BANK_ADMIN, Role.BANK_OPS)
export class ValidationController {
  constructor(private validationService: ValidationService) {}

  @Post('run')
  async run(
    @Body() dto: RunValidationDto,
    @CurrentUser() user: { tenantId: string; userId: string },
  ) {
    return this.validationService.run(user.tenantId, dto.merchantId, user.userId);
  }

  @Get('errors')
  async list(@CurrentUser() user: { tenantId: string }) {
    return this.validationService.listErrors(user.tenantId);
  }

  @Post('errors/:id/resolve')
  async resolve(
    @Param('id') id: string,
    @CurrentUser() user: { tenantId: string; userId: string },
  ) {
    return this.validationService.resolveError(user.tenantId, id, user.userId);
  }
}
