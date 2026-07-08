import { Controller, Get, Post, Patch, Body, Query, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReconciliationService } from './reconciliation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
export class ReconciliationController {
  constructor(private readonly service: ReconciliationService) {}

  @Post('import-ofx')
  @UseInterceptors(FileInterceptor('file'))
  async importOFX(@UploadedFile() file: any, @Body() body: any) {
    if (!file) throw new Error('Arquivo OFX obrigatório');
    const content = file.buffer.toString('utf-8');
    return this.service.importOFX(content, body.bankAccount || 'inter');
  }

  @Post('import-inter')
  async importFromInter(@Body() body: { startDate: string; endDate: string }) {
    if (!body.startDate || !body.endDate) throw new Error('Informe startDate e endDate');
    return this.service.importFromInterAPI(body.startDate, body.endDate);
  }

  @Post('auto-reconcile')
  async autoReconcile(@Body() body: { startDate: string; endDate: string; toleranceDays?: number; minScore?: number }) {
    return this.service.autoReconcile(body.startDate, body.endDate, body.toleranceDays || 3, body.minScore || 80);
  }

  @Post('manual-reconcile')
  async manualReconcile(@Body() body: { statementId: string; movementId: string }, @Request() req: any) {
    return this.service.manualReconcile(body.statementId, body.movementId, req.user.id);
  }

  @Post('undo')
  async undoReconcile(@Body() body: { statementId: string }, @Request() req: any) {
    return this.service.undoReconcile(body.statementId, req.user.id);
  }

  @Post('ignore')
  async ignoreStatement(@Body() body: { statementId: string }) {
    return this.service.ignoreStatement(body.statementId);
  }

  @Post('create-movement')
  async createMovement(@Body() body: { statementId: string }, @Request() req: any) {
    return this.service.createMovementFromStatement(body.statementId, req.user.id);
  }

  @Get('statements')
  async getStatements(@Query() query: any) {
    return this.service.findAll(query);
  }

  @Get('unmatched-movements')
  async getUnmatchedMovements(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.service.getUnmatchedMovements(startDate, endDate);
  }

  @Get('summary')
  async getSummary(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.service.getSummary(startDate, endDate);
  }
}
