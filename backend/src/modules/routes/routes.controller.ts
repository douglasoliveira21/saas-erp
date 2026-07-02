import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { RoutesService } from './routes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('routes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  create(@Body() dto: any, @Request() req: any) {
    return this.routesService.create({
      ...dto,
      technicianId: dto.technicianId || req.user.id,
    });
  }

  @Get()
  findAll() {
    return this.routesService.findAll();
  }

  @Get('summary')
  getSummary(@Request() req: any) {
    const isFinanceiro = req.user.role === 'financeiro' || req.user.role === 'admin';
    return this.routesService.getSummary(isFinanceiro ? undefined : req.user.id);
  }

  @Patch('approve-month')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  approveMonth(@Query('year') year: string, @Query('month') month: string, @Request() req: any) {
    return this.routesService.approveAllPendingByMonth(parseInt(year), parseInt(month), req.user.id);
  }

  @Patch('pay-month')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  payMonth(@Query('year') year: string, @Query('month') month: string, @Request() req: any) {
    return this.routesService.payAllApprovedByMonth(parseInt(year), parseInt(month), req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.routesService.findOne(id);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  approve(@Param('id') id: string, @Request() req: any) {
    return this.routesService.approve(id, req.user.id);
  }

  @Patch(':id/pay')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  pay(@Param('id') id: string, @Request() req: any) {
    return this.routesService.pay(id, req.user.id);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  cancel(@Param('id') id: string) {
    return this.routesService.cancel(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.routesService.remove(id);
  }

  @Patch(':id')
  @Roles(UserRole.TECNICO)
  update(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return this.routesService.update(id, dto, req.user.id);
  }
}
