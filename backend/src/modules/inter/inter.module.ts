import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InterService } from './inter.service';
import { InterController } from './inter.controller';
import { Sale } from '../sales/entities/sale.entity';
import { FinancialModule } from '../financial/financial.module';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { InterWebhookEvent } from './entities/inter-webhook-event.entity';
import { TenantBankConfig } from './entities/tenant-bank-config.entity';
import { BankCredentialsService } from './bank-credentials.service';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, AuditLog, InterWebhookEvent, TenantBankConfig]),
    FinancialModule,
    MailModule,
    AuditModule,
    PlatformModule,
  ],
  controllers: [InterController],
  providers: [InterService, BankCredentialsService],
  exports: [InterService, BankCredentialsService],
})
export class InterModule {}
