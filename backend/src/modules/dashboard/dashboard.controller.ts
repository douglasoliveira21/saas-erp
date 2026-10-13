import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getDashboardData() {
    return this.dashboardService.getDashboardData();
  }

  // Painel pessoal do técnico: só os números dele (ordens de serviço, rotas, comissões e vendas).
  @Get('technician')
  @Roles(UserRole.TECNICO)
  getTechnicianDashboard(@Request() req: any, @Query('month') month?: string) {
    return this.dashboardService.getTechnicianDashboard(req.user.id, month);
  }

  @Get('technicians-summary')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  getTechniciansSummary(@Query('month') month?: string) {
    return this.dashboardService.getTechniciansSummary(month);
  }

  @Get('overdue-customers')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  getOverdueCustomers() {
    return this.dashboardService.getOverdueCustomers();
  }
}
