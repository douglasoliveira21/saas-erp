import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuppliersService } from './suppliers.service';
import { SuppliersController, BillsController } from './suppliers.controller';
import { Supplier } from './entities/supplier.entity';
import { Bill } from './entities/bill.entity';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [TypeOrmModule.forFeature([Supplier, Bill]), PlatformModule],
  controllers: [SuppliersController, BillsController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
