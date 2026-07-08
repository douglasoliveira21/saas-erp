import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InterService } from './inter.service';
import { InterController } from './inter.controller';
import { Sale } from '../sales/entities/sale.entity';
import { FinancialModule } from '../financial/financial.module';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale]),
    FinancialModule,
    MailModule,
    AuditModule,
  ],
  controllers: [InterController],
  providers: [InterService],
  exports: [InterService],
})
export class InterModule {}
