import { Controller, Get, Post, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { GlpiService } from './glpi.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('glpi')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GlpiController {
  constructor(private readonly service: GlpiService) {}

  @Get('entities')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  getEntities() {
    return this.service.getEntities();
  }

  @Post('sync')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  syncTickets() {
    return this.service.syncTickets();
  }

  @Get('tickets')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  getTickets(@Query('customerId') customerId?: string, @Query('exceeded') exceeded?: string, @Query('month') month?: string) {
    return this.service.getTickets({
      customerId,
      exceeded: exceeded === 'true',
      month,
    });
  }

  @Get('sla-report')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  getSlaReport(@Query('month') month?: string) {
    return this.service.getSlaReport(month);
  }

  @Get('config')
  @Roles(UserRole.ADMIN)
  getConfig() {
    return this.service.getConfig2();
  }

  @Patch('config')
  @Roles(UserRole.ADMIN)
  updateConfig(@Body() body: any) {
    return this.service.updateConfig(body);
  }
}
