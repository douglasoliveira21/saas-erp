import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancialService } from './financial.service';
import { FinancialController } from './financial.controller';
import { AccountReceivable } from './entities/account-receivable.entity';
import { Installment } from './entities/installment.entity';
import { FinancialMovement } from './entities/financial-movement.entity';
import { CardFee } from './entities/card-fee.entity';
import { CustomerCredit } from './entities/customer-credit.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountReceivable,
      Installment,
      FinancialMovement,
      CardFee,
      CustomerCredit,
    ]),
  ],
  controllers: [FinancialController],
  providers: [FinancialService],
  exports: [FinancialService],
})
export class FinancialModule {}
