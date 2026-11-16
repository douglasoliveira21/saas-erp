import { BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { PlanGuard } from '../platform/guards/plan.guard';
import { RequireModule } from '../platform/decorators/require-module.decorator';
import { SuperAdminJwtAuthGuard } from '../platform/guards/super-admin-jwt-auth.guard';
import { Tenant } from '../platform/entities/tenant.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { BancoBrasilService } from './banco-brasil.service';

function testKind(body: any): 'boleto' | 'pix' {
  if (!['boleto', 'pix'].includes(body?.kind)) throw new BadRequestException('Selecione boleto ou Pix.');
  return body.kind;
}

@Controller('bb')
@RequireModule('pagamentos')
@Roles(UserRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard, PlanGuard)
export class BbController {
  constructor(private readonly bb: BancoBrasilService) {}
  @Get('bank-config') get() { return this.bb.config.publicConfig(); }
  @Post('bank-config') save(@Body() body: any) { return this.bb.config.save(body); }
  @Post('test-connection') test(@Body() body: any) { return this.bb.testConnection(testKind(body)); }
}

@Controller('super-admin/tenants/:tenantId/bb')
@UseGuards(SuperAdminJwtAuthGuard)
export class SuperAdminBbController {
  constructor(private readonly bb: BancoBrasilService, private readonly source: DataSource, private readonly context: TenantContextService) {}
  private async inTenant<T>(id: string, action: () => Promise<T>) {
    if (!await this.source.getRepository(Tenant).findOne({ where: { id } })) throw new NotFoundException('Empresa não encontrada.');
    return this.context.run(id, action);
  }
  @Get('bank-config') get(@Param('tenantId', ParseUUIDPipe) id: string) { return this.inTenant(id, () => this.bb.config.publicConfig()); }
  @Post('bank-config') save(@Param('tenantId', ParseUUIDPipe) id: string, @Body() body: any) { return this.inTenant(id, () => this.bb.config.save(body)); }
  @Post('test-connection') test(@Param('tenantId', ParseUUIDPipe) id: string, @Body() body: any) { return this.inTenant(id, () => this.bb.testConnection(testKind(body))); }
}
