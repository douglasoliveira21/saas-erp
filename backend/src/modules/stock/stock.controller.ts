import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { StockService } from './stock.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('stock')
@UseGuards(JwtAuthGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post('movements')
  create(@Body() createStockMovementDto: any, @Request() req: any) {
    return this.stockService.create({ ...createStockMovementDto, userId: createStockMovementDto.userId || req.user.id });
  }

  @Get('movements')
  findAll() {
    return this.stockService.findAll();
  }

  @Get('movements/:id')
  findOne(@Param('id') id: string) {
    return this.stockService.findOne(id);
  }

  @Delete('movements/:id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.stockService.remove(id, req.user.id);
  }
}
