import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma.module';
import { BankProvisioningController } from './bank-provisioning.controller';
import { BankProvisioningService } from './bank-provisioning.service';

@Module({
  imports: [PrismaModule],
  controllers: [BankProvisioningController],
  providers: [BankProvisioningService],
})
export class BankProvisioningModule {}

