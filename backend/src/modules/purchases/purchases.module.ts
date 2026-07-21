import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchasesService } from './purchases.service';
import { PurchasesController } from './purchases.controller';
import { Purchase } from './entities/purchase.entity';
import { FinancialMovement } from '../financial/entities/financial-movement.entity';
import { PurchaseItem } from './entities/purchase-item.entity';
import { PurchaseQuote } from './entities/purchase-quote.entity';
import { PurchaseAttachment } from './entities/purchase-attachment.entity';
import { Product } from '../products/entities/product.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { FinancialModule } from '../financial/financial.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Purchase, FinancialMovement, PurchaseItem, PurchaseQuote, PurchaseAttachment, Product, StockMovement]),
    FinancialModule,
    AuditModule,
  ],
  controllers: [PurchasesController],
  providers: [PurchasesService],
  exports: [PurchasesService],
})
export class PurchasesModule {}
