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
    // `next.handle()` retorna um Observable "frio" — nada executa ate alguem dar subscribe, e
    // com AuditInterceptor/OperationTrackingInterceptor tambem registrados como APP_INTERCEPTOR
    // globais, esse subscribe acontece dentro da cadeia de composicao interna do Nest, FORA da
    // pilha sincrona deste metodo. `storage.run(tenantId, () => next.handle())` so envolve a
    // CRIACAO do Observable, nao sua execucao — o handler de verdade (e tudo que ele faz de
    // async/await depois) roda sem tenant no contexto, e getTenantId() acaba retornando null la
    // dentro (foi exatamente o que causou o erro de tenant_id nulo ao gerar boleto). O fix e
    // garantir que o subscribe() em si aconteca dentro do run(), nao so a montagem do pipeline.
    return new Observable(subscriber => {
      this.tenantContext.run(tenantId, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
