import { Module } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { BranchesController } from './branches.controller';
import { PlacesModule } from '../places/places.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PlacesModule, AuditModule],
  providers: [BranchesService],
  controllers: [BranchesController],
})
export class BranchesModule {}
