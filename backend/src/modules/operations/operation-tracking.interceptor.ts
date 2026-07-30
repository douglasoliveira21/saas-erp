import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from, switchMap, tap } from 'rxjs';
import { OperationTrackingService } from './operation-tracking.service';

@Injectable()
export class OperationTrackingInterceptor implements NestInterceptor {
  constructor(private readonly tracking: OperationTrackingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = String(request.method || '').toUpperCase();
    if (!['POST','PUT','PATCH','DELETE'].includes(method) || String(request.path || '').includes('/operations/executions')) return next.handle();
    const started = Date.now();
    const entityId = request.params?.id || request.params?.saleId || request.params?.invoiceId || request.body?.id || request.body?.saleId || request.body?.invoiceId || null;
    return from(this.tracking.startSafe({ method, path: request.originalUrl || request.path, action: `${method} ${request.route?.path || request.path}`, entityId, body: request.body, userId: request.user?.id, ip: request.ip, userAgent: request.headers?.['user-agent'] })).pipe(
      switchMap(operationId => next.handle().pipe(tap({
        next: response => void this.tracking.completeSafe(operationId, response, Date.now() - started),
        error: error => void this.tracking.failSafe(operationId, error, Date.now() - started),
      }))),
    );
  }
}