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
import { QuotesModule } from './modules/quotes/quotes.module';
import { OperationsModule } from './modules/operations/operations.module';
import { CrmModule } from './modules/crm/crm.module';
import { CustomerPortalModule } from './modules/customer-portal/customer-portal.module';
import { ServiceOrdersModule } from './modules/service-orders/service-orders.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { PlatformModule } from './modules/platform/platform.module';
import { DatabaseConfig } from './config/database.config';
import { HealthController } from './health.controller';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { OperationTrackingInterceptor } from './modules/operations/operation-tracking.interceptor';
import { TenantContextModule } from './common/tenant/tenant-context.module';
import { TenantContextInterceptor } from './common/tenant/tenant-context.interceptor';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    TenantContextModule,
    PlatformModule,
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
    QuotesModule,
    OperationsModule,
    CrmModule,
    CustomerPortalModule,
    ServiceOrdersModule,
    WhatsappModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_INTERCEPTOR, useClass: OperationTrackingInterceptor },
  ],
})
export class AppModule {}
