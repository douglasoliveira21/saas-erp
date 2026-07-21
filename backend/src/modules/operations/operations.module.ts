import { Module } from '@nestjs/common';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { AuditModule } from '../audit/audit.module';

@Module({ imports: [AuditModule], controllers: [OperationsController], providers: [OperationsService] })
export class OperationsModule {}
