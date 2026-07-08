import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ProductsModule } from './modules/products/products.module';
import { ServicesModule } from './modules/services/services.module';
import { StockModule } from './modules/stock/stock.module';
import { SalesModule } from './modules/sales/sales.module';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { RoutesModule } from './modules/routes/routes.module';
import { FinancialTasksModule } from './modules/financial-tasks/financial-tasks.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { GlpiModule } from './modules/glpi/glpi.module';
import { MailModule } from './modules/mail/mail.module';
import { FiscalModule } from './modules/fiscal/fiscal.module';
import { FinancialModule } from './modules/financial/financial.module';
import { InterModule } from './modules/inter/inter.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { DatabaseConfig } from './config/database.config';
import { HealthController } from './health.controller';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    AuthModule,
    UsersModule,
    CustomersModule,
    ProductsModule,
    ServicesModule,
    StockModule,
    SalesModule,
    CommissionsModule,
    DashboardModule,
    ReportsModule,
    AuditModule,
    RoutesModule,
    FinancialTasksModule,
    ContractsModule,
    GlpiModule,
    MailModule,
    FiscalModule,
    FinancialModule,
    InterModule,
    VehiclesModule,
    PurchasesModule,
    ReconciliationModule,
    SuppliersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
