import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappConfig } from './entities/whatsapp-config.entity';
import { WhatsappMessageLog } from './entities/whatsapp-message-log.entity';
import { WhatsappService } from './whatsapp.service';
import { WhatsappJobsService } from './whatsapp-jobs.service';
import { WhatsappController } from './whatsapp.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WhatsappConfig, WhatsappMessageLog])],
  providers: [WhatsappService, WhatsappJobsService],
  controllers: [WhatsappController],
  exports: [WhatsappService],
})
export class WhatsappModule {}
