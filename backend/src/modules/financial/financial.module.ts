import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancialService } from './financial.service';
import { FinancialController } from './financial.controller';
import { AccountReceivable } from './entities/account-receivable.entity';
import { Installment } from './entities/installment.entity';
import { FinancialMovement } from './entities/financial-movement.entity';
import { CardFee } from './entities/card-fee.entity';
import { CustomerCredit } from './entities/customer-credit.entity';
import { AuditModule } from '../audit/audit.module';
import { CostCenter } from './entities/cost-center.entity';
import { ChartAccount } from './entities/chart-account.entity';
import { BankAccount } from './entities/bank-account.entity';
import { MonthlyClosing } from './entities/monthly-closing.entity';
import { InstallmentPayment } from './entities/installment-payment.entity';
import { AccountPayable } from './entities/account-payable.entity';
import { PlatformModule } from '../platform/platform.module';
import { Bill } from '../suppliers/entities/bill.entity';
import { Invoice } from '../fiscal/entities/invoice.entity';
import { SaleItem } from '../sales/entities/sale-item.entity';
import { CompanyProfile } from '../company-profile/entities/company-profile.entity';
import { CashFlowReportPdfService } from './cash-flow-report-pdf.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountReceivable,
      Installment,
      FinancialMovement,
      CardFee,
      CustomerCredit,
      CostCenter,
      ChartAccount,
      BankAccount,
      MonthlyClosing,
      InstallmentPayment,
      AccountPayable,
      Bill,
      Invoice,
      SaleItem,
      CompanyProfile,
    ]),
    AuditModule,
    PlatformModule,
  ],
  controllers: [FinancialController],
  providers: [FinancialService, CashFlowReportPdfService],
  exports: [FinancialService],
})
export class FinancialModule {}
