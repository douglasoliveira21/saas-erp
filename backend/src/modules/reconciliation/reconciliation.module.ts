import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';
import { BankStatement } from './entities/bank-statement.entity';
import { InterModule } from '../inter/inter.module';
import { FinancialModule } from '../financial/financial.module';

@Module({
  imports: [TypeOrmModule.forFeature([BankStatement]), InterModule, FinancialModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
