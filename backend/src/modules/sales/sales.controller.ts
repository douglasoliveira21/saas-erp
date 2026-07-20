import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  create(@Body() createSaleDto: any, @Request() req: any) {
    return this.salesService.create({ ...createSaleDto, technicianId: createSaleDto.technicianId || req.user.id }, req.user.id);
  }

  @Get()
  findAll() {
    return this.salesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  approve(@Param('id') id: string, @Request() req: any) {
    return this.salesService.approve(id, req.user.id);
  }

  @Patch(':id/boleto-emitido')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  markBoletoEmitido(@Param('id') id: string, @Request() req: any) {
    return this.salesService.markBoletoEmitido(id, req.user.id);
  }

  @Patch(':id/mark-paid')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  markPaid(@Param('id') id: string, @Request() req: any) {
    return this.salesService.markPaid(id, req.user.id);
  }

  @Patch(':id/finalize')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  finalize(@Param('id') id: string) {
    return this.salesService.finalize(id);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.salesService.cancel(id, req.user.id);
  }

  @Post(':id/send-documents')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  sendDocuments(@Param('id') id: string, @Body() body: any) {
    return this.salesService.sendCustomerDocuments(id, body?.body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSaleDto: any, @Request() req: any) {
    return this.salesService.update(id, updateSaleDto, req.user.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.salesService.remove(id, req.user.id);
  }
}
