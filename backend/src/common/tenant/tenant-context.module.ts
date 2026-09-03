import { Global, Module } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';

// @Global() para que qualquer módulo injete TenantContextService sem precisar importar este
// módulo explicitamente — é uma preocupação transversal, igual a logging ou auditoria.
@Global()
@Module({
  providers: [TenantContextService],
  exports: [TenantContextService],
})
export class TenantContextModule {}
