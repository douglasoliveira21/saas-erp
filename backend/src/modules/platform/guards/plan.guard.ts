import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantsService } from '../tenants.service';
import { REQUIRE_MODULE_KEY } from '../decorators/require-module.decorator';

// Roda depois de JwtAuthGuard/RolesGuard (a ordem em @UseGuards importa). Se o controller/rota
// não tiver @RequireModule, deixa passar — nem toda rota corresponde a um módulo comercial
// (ex.: perfil do próprio usuário, dashboard). Rotas de super admin nunca têm req.user.tenantId
// (usam SuperAdminJwtAuthGuard, um mecanismo totalmente separado), então esse guard também
// nunca se aplica a elas.
@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private tenantsService: TenantsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<string>(REQUIRE_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredModule) return true;

    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;
    if (!tenantId) return true;

    const modules = await this.tenantsService.getEnabledModules(tenantId);
    if (!modules.includes(requiredModule)) {
      throw new ForbiddenException('Este recurso não está incluído no plano contratado.');
    }
    return true;
  }
}
