import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextService } from './tenant-context.service';

// Roda depois dos guards (JwtAuthGuard já populou request.user nesse ponto), então
// request.user.tenantId está disponível aqui. Envolve o resto da requisição num contexto de
// AsyncLocalStorage para que qualquer service consiga ler o tenant atual via
// TenantContextService, sem precisar receber o tenantId por parâmetro em toda chamada.
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId || null;
    return this.tenantContext.run(tenantId, () => next.handle());
  }
}
