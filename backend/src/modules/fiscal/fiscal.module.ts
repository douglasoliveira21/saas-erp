import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FiscalController } from './fiscal.controller';
import { CertificateService } from './services/certificate.service';
import { NfeService } from './services/nfe.service';
import { NfseService } from './services/nfse.service';
import { Certificate } from './entities/certificate.entity';
import { Invoice } from './entities/invoice.entity';
import { FiscalConfig } from './entities/fiscal-config.entity';
import { FinancialTask } from '../financial-tasks/entities/financial-task.entity';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [TypeOrmModule.forFeature([Certificate, Invoice, FiscalConfig, FinancialTask]), MailModule],
  controllers: [FiscalController],
  providers: [CertificateService, NfeService, NfseService],
  exports: [CertificateService, NfeService, NfseService],
})
export class FiscalModule {}
