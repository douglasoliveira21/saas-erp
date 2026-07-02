import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { CommissionsService } from './commissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('commissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  create(@Body() createCommissionDto: any) {
    return this.commissionsService.create(createCommissionDto);
  }

  @Post('generate-monthly')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  generateMonthly(@Body() body: any) {
    return this.commissionsService.generateMonthlyFixed(body.month);
  }

  @Get()
  findAll() {
    return this.commissionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.commissionsService.findOne(id);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  approve(@Param('id') id: string, @Request() req: any) {
    return this.commissionsService.approve(id, req.user.id);
  }

  @Patch(':id/pay')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  pay(@Param('id') id: string, @Request() req: any) {
    return this.commissionsService.pay(id, req.user.id);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  cancel(@Param('id') id: string) {
    return this.commissionsService.cancel(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  update(@Param('id') id: string, @Body() updateCommissionDto: any) {
    return this.commissionsService.update(id, updateCommissionDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.commissionsService.remove(id);
  }
}
