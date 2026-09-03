import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancialTasksService } from './financial-tasks.service';
import { FinancialTasksController } from './financial-tasks.controller';
import { FinancialTask } from './entities/financial-task.entity';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [TypeOrmModule.forFeature([FinancialTask]), PlatformModule],
  controllers: [FinancialTasksController],
  providers: [FinancialTasksService],
  exports: [FinancialTasksService],
})
export class FinancialTasksModule {}
