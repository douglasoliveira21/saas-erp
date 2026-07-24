import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = String(request.method || '').toUpperCase();
    if (!['POST','PUT','PATCH','DELETE'].includes(method) || request.path?.startsWith('/api/audit')) return next.handle();
    const mask = (value: any): any => {
      if (Array.isArray(value)) return value.map(mask);
      if (!value || typeof value !== 'object') return value;
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /password|token|secret|certificate|authorization|cookie/i.test(key) ? '***' : mask(item)]));
    };
    const entity = String(request.originalUrl || request.path || 'unknown').split('?')[0].split('/').filter(Boolean).filter((part: string) => part !== 'api')[0] || 'unknown';
    return next.handle().pipe(tap((response) => void this.auditService.safeCreate({ userId: request.user?.id || null, action: 'http.' + method.toLowerCase(), entity, entityId: request.params?.id || response?.id || null, newData: { path: request.originalUrl?.split('?')[0], body: mask(request.body || {}) }, ipAddress: request.ip, userAgent: request.headers?.['user-agent'] || null })));
  }
}
