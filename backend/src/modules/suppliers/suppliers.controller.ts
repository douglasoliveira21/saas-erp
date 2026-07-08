import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  // ==================== SUPPLIERS ====================
  @Post()
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  createSupplier(@Body() dto: any) { return this.service.createSupplier(dto); }

  @Get()
  findAllSuppliers() { return this.service.findAllSuppliers(); }

  @Get(':id')
  findOneSupplier(@Param('id') id: string) { return this.service.findOneSupplier(id); }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  updateSupplier(@Param('id') id: string, @Body() dto: any) { return this.service.updateSupplier(id, dto); }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  removeSupplier(@Param('id') id: string) { return this.service.removeSupplier(id); }
}

@Controller('bills')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillsController {
  constructor(private readonly service: SuppliersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  createBill(@Body() dto: any, @Request() req: any) { return this.service.createBill(dto, req.user.id); }

  @Get()
  findAllBills(@Query() query: any) { return this.service.findAllBills(query); }

  @Get('alerts')
  getAlerts(@Query('days') days?: string) { return this.service.getAlerts(days ? parseInt(days) : 7); }

  @Get('summary')
  getSummary() { return this.service.getSummary(); }

  @Get('report')
  getReport(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) { return this.service.getReportBySupplier(startDate, endDate); }

  @Get(':id')
  findOneBill(@Param('id') id: string) { return this.service.findOneBill(id); }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  updateBill(@Param('id') id: string, @Body() dto: any) { return this.service.updateBill(id, dto); }

  @Patch(':id/pay')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  payBill(@Param('id') id: string, @Body() body: any) { return this.service.payBill(id, body); }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  cancelBill(@Param('id') id: string) { return this.service.cancelBill(id); }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  removeBill(@Param('id') id: string) { return this.service.removeBill(id); }
}
