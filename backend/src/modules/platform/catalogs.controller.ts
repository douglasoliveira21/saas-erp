import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MunicipalitiesService } from './municipalities.service';
import { BanksService } from './banks.service';
import { TenantsService } from './tenants.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

// Leitura dos catálogos de plataforma (municípios/bancos) para qualquer tenant autenticado —
// dado de referência, não é controlado por plano nem exige role de admin.
@Controller('catalogs')
@UseGuards(JwtAuthGuard)
export class CatalogsController {
  constructor(
    private readonly municipalitiesService: MunicipalitiesService,
    private readonly banksService: BanksService,
    private readonly tenantsService: TenantsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get('municipalities')
  findAllMunicipalities() {
    return this.municipalitiesService.findAll();
  }

  @Get('municipalities/:ibgeCode')
  async findMunicipality(@Param('ibgeCode') ibgeCode: string) {
    const municipality = await this.municipalitiesService.findByIbgeCode(ibgeCode);
    return municipality || { found: false };
  }

  @Get('banks')
  findAllBanks() {
    return this.banksService.findAll();
  }

  // Qual banco/município este tenant está vinculado (escolhido na criação, ou depois pelo super
  // admin) - usado pelas telas de configuração de banco/fiscal do próprio tenant pra saber se
  // devem mostrar o formulário de credenciais de verdade ou um aviso de "ainda não disponível".
  @Get('my-tenant')
  async myTenantCatalogs() {
    const tenantId = this.tenantContext.requireTenantId();
    const tenant = await this.tenantsService.findOne(tenantId);
    return { bank: tenant.bank || null, municipality: tenant.municipality || null };
  }
}
