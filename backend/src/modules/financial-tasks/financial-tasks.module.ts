import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinancialTasksService } from './financial-tasks.service';
import { FinancialTasksController } from './financial-tasks.controller';
import { FinancialTask } from './entities/financial-task.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FinancialTask])],
  controllers: [FinancialTasksController],
  providers: [FinancialTasksService],
  exports: [FinancialTasksService],
})
export class FinancialTasksModule {}
