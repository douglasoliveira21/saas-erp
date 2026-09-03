import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

interface TenantStore {
  tenantId: string | null;
}

// Uma única AsyncLocalStorage compartilhada por todo o processo — o valor "atual" segue
// automaticamente qualquer await/then dentro da mesma requisição, sem precisar passar
// tenantId por parâmetro em cada método de cada service.
const storage = new AsyncLocalStorage<TenantStore>();

@Injectable()
export class TenantContextService {
  run<T>(tenantId: string | null, fn: () => T): T {
    return storage.run({ tenantId }, fn);
  }

  getTenantId(): string | null {
    return storage.getStore()?.tenantId ?? null;
  }

  // Use quando a ausência de tenant no contexto for um bug (ex.: dentro de um service que só
  // deveria rodar durante uma requisição autenticada de um tenant).
  requireTenantId(): string {
    const tenantId = this.getTenantId();
    if (!tenantId) throw new Error('Nenhum tenant no contexto da requisição atual');
    return tenantId;
  }
}
