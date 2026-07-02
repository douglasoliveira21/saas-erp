import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { FinancialTasksService } from './financial-tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('financial-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinancialTasksController {
  constructor(private readonly service: FinancialTasksService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  findAll() {
    return this.service.findAll();
  }

  @Get('pending')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  findPending() {
    return this.service.findPending();
  }

  @Get('today')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  getTodayTasks() {
    return this.service.getTodayTasks();
  }

  @Patch(':id/complete')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  complete(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.service.complete(id, req.user.id, body.observations);
  }
}
