import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CompanyProfileService } from './company-profile.service';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

@Controller('company-profile')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompanyProfileController {
  constructor(
    private readonly service: CompanyProfileService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  async get() {
    const profile = await this.service.getForTenant(this.tenantContext.requireTenantId());
    if (!profile) return {};
    // Só os campos editáveis - o frontend guarda essa resposta e reenvia tudo no PATCH, então
    // id/tenantId/createdAt/updatedAt não podem vir aqui (forbidNonWhitelisted rejeitaria com 400).
    const { razaoSocial, cnpj, inscricaoEstadual, inscricaoMunicipal, cep, endereco, telefone, logo } = profile;
    return { razaoSocial, cnpj, inscricaoEstadual, inscricaoMunicipal, cep, endereco, telefone, logo };
  }

  @Patch()
  @Roles(UserRole.ADMIN)
  update(@Body() dto: UpdateCompanyProfileDto) {
    return this.service.upsert(this.tenantContext.requireTenantId(), dto);
  }
}
