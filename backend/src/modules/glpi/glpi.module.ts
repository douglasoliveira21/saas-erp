import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlpiService } from './glpi.service';
import { GlpiController } from './glpi.controller';
import { GlpiTicket } from './entities/glpi-ticket.entity';
import { GlpiConfig } from './entities/glpi-config.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Contract } from '../contracts/entities/contract.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GlpiTicket, GlpiConfig, Customer, Contract])],
  controllers: [GlpiController],
  providers: [GlpiService],
  exports: [GlpiService],
})
export class GlpiModule {}
