import { Module } from '@nestjs/common';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { AuditModule } from '../audit/audit.module';
import { OperationTrackingService } from './operation-tracking.service';
import { PlatformModule } from '../platform/platform.module';

@Module({ imports: [AuditModule, PlatformModule], controllers: [OperationsController], providers: [OperationsService, OperationTrackingService], exports: [OperationTrackingService] })
export class OperationsModule {}
