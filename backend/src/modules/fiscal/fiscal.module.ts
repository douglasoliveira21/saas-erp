import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FiscalController } from './fiscal.controller';
import { CertificateService } from './services/certificate.service';
import { NfeService } from './services/nfe.service';
import { NfseService } from './services/nfse.service';
import { DanfePdfService } from './services/danfe-pdf.service';
import { FiscalIntegrationService } from './services/fiscal-integration.service';
import { FiscalJobsService } from './services/fiscal-jobs.service';
import { Certificate } from './entities/certificate.entity';
import { Invoice } from './entities/invoice.entity';
import { FiscalConfig } from './entities/fiscal-config.entity';
import { FiscalEvent } from './entities/fiscal-event.entity';
import { FinancialTask } from '../financial-tasks/entities/financial-task.entity';
import { FinancialMovement } from '../financial/entities/financial-movement.entity';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';
import { Sale } from '../sales/entities/sale.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Certificate, Invoice, FiscalConfig, FiscalEvent, FinancialTask, FinancialMovement, Sale]), MailModule, AuditModule],
  controllers: [FiscalController],
  providers: [CertificateService, NfeService, NfseService, DanfePdfService, FiscalIntegrationService, FiscalJobsService],
  exports: [CertificateService, NfeService, NfseService, DanfePdfService],
})
export class FiscalModule {}
