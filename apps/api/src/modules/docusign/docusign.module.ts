import { Module } from '@nestjs/common';
import { DocusignService } from './docusign.service';

@Module({
  providers: [DocusignService],
  exports: [DocusignService],
})
export class DocusignModule {}
