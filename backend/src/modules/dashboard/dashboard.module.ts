import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Sale } from '../sales/entities/sale.entity';
import { Commission } from '../commissions/entities/commission.entity';
import { Product } from '../products/entities/product.entity';
import { Route } from '../routes/entities/route.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Sale, Commission, Product, Route])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
