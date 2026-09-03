import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceOrder } from './entities/service-order.entity';
import { ServiceOrderStatus } from './entities/service-order-status.entity';
import { ServiceOrderAttachment } from './entities/service-order-attachment.entity';
import { ServiceOrderEvent } from './entities/service-order-event.entity';
import { FiscalConfig } from '../fiscal/entities/fiscal-config.entity';
import { ServiceOrdersService } from './service-orders.service';
import { ServiceOrderPdfService } from './service-order-pdf.service';
import { ServiceOrdersController } from './service-orders.controller';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceOrder, ServiceOrderStatus, ServiceOrderAttachment, ServiceOrderEvent, FiscalConfig]), WhatsappModule, PlatformModule],
  providers: [ServiceOrdersService, ServiceOrderPdfService],
  controllers: [ServiceOrdersController],
  exports: [ServiceOrdersService],
})
export class ServiceOrdersModule {}
