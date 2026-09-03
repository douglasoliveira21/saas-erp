import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailConfig } from './entities/email-config.entity';
import { EmailDeliveryLog } from './entities/email-delivery-log.entity';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { AuditModule } from '../audit/audit.module';
import { PlatformModule } from '../platform/platform.module';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([EmailConfig, EmailDeliveryLog]), AuditModule, PlatformModule],
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
