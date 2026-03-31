import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BanksModule } from './banks/banks.module';
import { BankBranchesModule } from './bank-branches/bank-branches.module';
import { MerchantsModule } from './merchants/merchants.module';
import { BranchesModule } from './branches/branches.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { InvitationsModule } from './invitations/invitations.module';
import { ValidationModule } from './validation/validation.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';
import { StorageModule } from './storage/storage.module';
import { PlacesModule } from './places/places.module';
import { DocusignModule } from './docusign/docusign.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    BanksModule,
    BankBranchesModule,
    MerchantsModule,
    BranchesModule,
    CampaignsModule,
    InvitationsModule,
    ValidationModule,
    NotificationsModule,
    AuditModule,
    StorageModule,
    PlacesModule,
    DocusignModule,
  ],
})
export class AppModule {}
