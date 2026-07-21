import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchasesController {
  constructor(private readonly service: PurchasesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  create(@Body() body: any, @Request() req: any) {
    return this.service.create({
      ...body,
      totalValue: body.totalValue ? parseFloat(body.totalValue) : 0,
      createdBy: req.user.id,
    });
  }

  @Post('requests')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  createRequest(@Body() body: any, @Request() req: any) {
    return this.service.createRequest(body, req.user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  findAll(@Query('type') type?: string) {
    return this.service.findAll(type);
  }

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  getSummary() {
    return this.service.getSummary();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  update(@Param('id') id: string, @Body() body: any) {
    if (body.totalValue) body.totalValue = parseFloat(body.totalValue);
    return this.service.update(id, body);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  approve(@Param('id') id: string, @Request() req: any) {
    return this.service.approve(id, req.user.id);
  }

  @Post(':id/quotes')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  addQuote(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.service.addQuote(id, body, req.user.id);
  }

  @Patch(':id/quotes/:quoteId/choose')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  chooseQuote(@Param('id') id: string, @Param('quoteId') quoteId: string, @Request() req: any) {
    return this.service.chooseQuote(id, quoteId, req.user.id);
  }

  @Post(':id/order')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  createOrder(@Param('id') id: string, @Request() req: any) {
    return this.service.createOrder(id, req.user.id);
  }

  @Patch(':id/receive')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  receive(@Param('id') id: string, @Request() req: any) {
    return this.service.receive(id, req.user.id);
  }

  @Patch(':id/receive-partial')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  receivePartial(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.service.receivePartial(id, body.items || [], req.user.id);
  }

  @Post(':id/attachments')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  addAttachment(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.service.addAttachment(id, body, req.user.id);
  }

  @Patch(':id/return')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  returnPurchase(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.service.returnPurchase(id, req.user.id, body.reason || 'Devolução');
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
