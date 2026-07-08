import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuotesService } from './quotes.service';
import { QuotesController, QuotesPublicController } from './quotes.controller';
import { Quote } from './entities/quote.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Quote])],
  controllers: [QuotesController, QuotesPublicController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
