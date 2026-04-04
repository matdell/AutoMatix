import { Module } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { BrandsController } from './brands.controller';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [AuditModule, StorageModule],
  providers: [BrandsService],
  controllers: [BrandsController],
})
export class BrandsModule {}
