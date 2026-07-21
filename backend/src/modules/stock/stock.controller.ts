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
import { Permissions } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard)
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

  @Get('low-stock')
  getLowStock() {
    return this.stockService.getLowStock();
  }

  @Get('kardex/:productId')
  getKardex(@Param('productId') productId: string) {
    return this.stockService.getKardex(productId);
  }

  @Post('inventory/:productId')
  @Permissions('stock.inventory')
  inventoryAdjust(@Param('productId') productId: string, @Body() body: any, @Request() req: any) {
    return this.stockService.inventoryAdjust(productId, body.countedQuantity, body.justification, req.user.id);
  }

  @Post('reserve/:productId')
  @Permissions('stock.reserve')
  reserve(@Param('productId') productId: string, @Body() body: any, @Request() req: any) {
    return this.stockService.reserve(productId, Number(body.quantity), req.user.id, body.reason);
  }

  @Post('release-reservation/:productId')
  @Permissions('stock.reserve')
  releaseReservation(@Param('productId') productId: string, @Body() body: any, @Request() req: any) {
    return this.stockService.releaseReservation(productId, Number(body.quantity), req.user.id, body.reason);
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
