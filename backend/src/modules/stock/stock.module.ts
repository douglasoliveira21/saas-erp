import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { StockMovement } from './entities/stock-movement.entity';
import { Product } from '../products/entities/product.entity';
import { FinancialModule } from '../financial/financial.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([StockMovement, Product]), FinancialModule, AuditModule],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService, TypeOrmModule],
})
export class StockModule {}
