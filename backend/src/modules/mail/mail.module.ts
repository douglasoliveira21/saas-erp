import { Module, Global, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailConfig } from './entities/email-config.entity';
import { EmailDeliveryLog } from './entities/email-delivery-log.entity';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { AuditModule } from '../audit/audit.module';
import { PlatformModule } from '../platform/platform.module';

@Global()
@Module({
  // forwardRef: PlatformModule (SuperAdminAuthService) agora também depende do MailService,
  // pra mandar o código de verificação por email - sem forwardRef dos dois lados o Nest recusa
  // resolver o ciclo PlatformModule -> MailModule -> PlatformModule no boot.
  imports: [TypeOrmModule.forFeature([EmailConfig, EmailDeliveryLog]), AuditModule, forwardRef(() => PlatformModule)],
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
