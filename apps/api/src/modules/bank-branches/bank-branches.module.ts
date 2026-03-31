import { Module } from '@nestjs/common';
import { BankBranchesController } from './bank-branches.controller';
import { BankBranchesService } from './bank-branches.service';
import { PrismaModule } from '../common/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BankBranchesController],
  providers: [BankBranchesService],
})
export class BankBranchesModule {}
