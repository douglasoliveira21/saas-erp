import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FinancialService } from './financial.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('financial')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  // ==================== Accounts ====================

  @Get('accounts')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  findAllAccounts(
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('paymentMethod') paymentMethod?: string,
  ) {
    return this.financialService.findAll({ status, customerId, startDate, endDate, paymentMethod });
  }

  // ==================== Installments ====================

  @Get('installments')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  findAllInstallments(
    @Query('status') status?: string,
    @Query('accountId') accountId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financialService.findInstallments({ status, accountId, startDate, endDate });
  }

  // ==================== Movements ====================

  @Get('movements')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  findAllMovements(
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('isForecast') isForecast?: string,
  ) {
    return this.financialService.findMovements({
      type,
      category,
      startDate,
      endDate,
      isForecast: isForecast !== undefined ? isForecast === 'true' : undefined,
    });
  }

  // ==================== Actions ====================

  @Post('pay/:installmentId')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  payInstallment(
    @Param('installmentId') installmentId: string,
    @Body() body: { value: number; paymentMethod: string },
    @Request() req: any,
  ) {
    return this.financialService.payInstallment(
      installmentId,
      body.value,
      body.paymentMethod,
      req.user.id,
    );
  }

  @Post('cancel/:accountId')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  cancelAccount(
    @Param('accountId') accountId: string,
    @Body() body: { reason: string },
    @Request() req: any,
  ) {
    return this.financialService.cancelAccount(accountId, body.reason, req.user.id);
  }

  @Post('credit')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  createCredit(
    @Body() body: { customerId: string; saleId: string; value: number; reason: string },
    @Request() req: any,
  ) {
    return this.financialService.createCredit(
      body.customerId,
      body.saleId,
      body.value,
      body.reason,
      req.user.id,
    );
  }

  // ==================== Reports ====================

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  getDashboard() {
    return this.financialService.getDashboard();
  }

  @Get('flow')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  getFlow(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.financialService.getFlowByPeriod(startDate, endDate);
  }

  @Get('overdue')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  getOverdue() {
    return this.financialService.getOverdue();
  }

  // ==================== Card Fees ====================

  @Get('card-fees')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  findAllCardFees() {
    return this.financialService.findAllCardFees();
  }

  @Post('card-fees')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  createCardFee(@Body() body: any) {
    return this.financialService.createCardFee(body);
  }

  @Delete('card-fees/:id')
  @Roles(UserRole.ADMIN)
  deleteCardFee(@Param('id') id: string) {
    return this.financialService.deleteCardFee(id);
  }

  // ==================== Sync ====================

  @Post('movements')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  createMovementEndpoint(@Body() body: any, @Request() req: any) {
    return this.financialService.createManualMovement(body, req.user.id);
  }

  @Post('movements/recurring')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  createRecurringMovement(@Body() body: any, @Request() req: any) {
    return this.financialService.createRecurringMovement(body, req.user.id);
  }

  @Patch('movements/:id')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  updateMovement(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.financialService.updateMovement(id, body, req.user.id);
  }

  @Delete('movements/:id')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  deleteMovement(@Param('id') id: string, @Request() req: any) {
    return this.financialService.deleteMovement(id, req.user.id);
  }

  @Post('sync-sales')
  @Roles(UserRole.ADMIN)
  syncSales(@Request() req: any) {
    return this.financialService.syncExistingSales(req.user.id);
  }
}
