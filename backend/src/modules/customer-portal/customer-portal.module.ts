import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Customer } from '../customers/entities/customer.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { GlpiTicket } from '../glpi/entities/glpi-ticket.entity';
import { GlpiModule } from '../glpi/glpi.module';
import { InterModule } from '../inter/inter.module';
import { FiscalModule } from '../fiscal/fiscal.module';
import { PortalUser } from './entities/portal-user.entity';
import { PortalTicketForm } from './entities/portal-form.entity';
import { PortalTicket } from './entities/portal-ticket.entity';
import { CustomerPortalController } from './customer-portal.controller';
import { CustomerPortalService } from './customer-portal.service';
import { PortalAuthGuard } from './portal-auth.guard';
import { PortalNotificationsService } from './portal-notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([PortalUser, PortalTicketForm, PortalTicket, Customer, Contract, GlpiTicket]), AuthModule, GlpiModule, InterModule, FiscalModule],
  controllers: [CustomerPortalController],
  providers: [CustomerPortalService, PortalAuthGuard, PortalNotificationsService],
})
export class CustomerPortalModule {}
