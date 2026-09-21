import { Controller, Get, Patch, Param, Query, Request, UseGuards } from '@nestjs/common';
import { SecurityService } from './security.service';
import { SuperAdminJwtAuthGuard } from './guards/super-admin-jwt-auth.guard';

// Painel de segurança do super admin: IPs bloqueados por excesso de tentativas de login, contas
// de qualquer tenant bloqueadas pelo mesmo motivo, e os logs de erro/auditoria do sistema
// inteiro (visão cross-tenant, só o super admin vê tudo junto).
@Controller('super-admin/security')
@UseGuards(SuperAdminJwtAuthGuard)
export class SecurityController {
  constructor(private readonly service: SecurityService) {}

  @Get('blocked-ips')
  findBlockedIps() {
    return this.service.findBlockedIps();
  }

  @Patch('blocked-ips/:id/unblock')
  unblockIp(@Param('id') id: string, @Request() req: any) {
    return this.service.unblockIp(id, req.user.id);
  }

  @Get('locked-accounts')
  findLockedAccounts() {
    return this.service.findLockedAccounts();
  }

  @Patch('locked-accounts/:userId/unlock')
  unlockAccount(@Param('userId') userId: string) {
    return this.service.unlockAccount(userId);
  }

  @Get('error-logs')
  findErrorLogs(@Query('limit') limit?: string) {
    return this.service.findErrorLogs(limit ? Number(limit) : undefined);
  }

  @Get('audit-logs')
  findAuditLogs(@Query('limit') limit?: string) {
    return this.service.findAuditLogs(limit ? Number(limit) : undefined);
  }
}
