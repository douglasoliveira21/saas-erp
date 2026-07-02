import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Sale } from '../sales/entities/sale.entity';
import { Commission } from '../commissions/entities/commission.entity';
import { Product } from '../products/entities/product.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Sale, Commission, Product, StockMovement])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
