import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { Product } from '../products/entities/product.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { Commission } from '../commissions/entities/commission.entity';
import { FinancialTask } from '../financial-tasks/entities/financial-task.entity';
import { FinancialModule } from '../financial/financial.module';
import { InterModule } from '../inter/inter.module';
import { FiscalModule } from '../fiscal/fiscal.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, SaleItem, Product, StockMovement, Commission, FinancialTask]),
    FinancialModule,
    InterModule,
    FiscalModule,
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
