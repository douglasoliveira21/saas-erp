import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ContractsService } from './contracts.service';
import { ContractBillingService } from './contract-billing.service';
import { ContractsController } from './contracts.controller';
import { Contract } from './entities/contract.entity';
import { InterModule } from '../inter/inter.module';
import { FiscalModule } from '../fiscal/fiscal.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract]),
    MulterModule.register({ dest: './uploads/contracts' }),
    InterModule,
    FiscalModule,
    MailModule,
  ],
  controllers: [ContractsController],
  providers: [ContractsService, ContractBillingService],
  exports: [ContractsService, ContractBillingService],
})
export class ContractsModule {}
