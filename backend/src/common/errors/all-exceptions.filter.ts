import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorLog } from './error-log.entity';

// Pega QUALQUER exceção não tratada de QUALQUER rota (inclusive GET, e a rota de auth - as duas
// coisas que operation_runs ignora de propósito) e grava um registro antes de deixar o Nest
// responder normalmente. Estende BaseExceptionFilter e chama super.catch() por último
// exatamente pelo motivo documentado pelo próprio Nest ("catch everything"): preserva 100% do
// formato de resposta padrão (mensagem, status, corpo) que cada controller já espera - este
// filtro só observa o erro, nunca decide como ele é respondido.
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  constructor(@InjectRepository(ErrorLog) private readonly errorLogRepo: Repository<ErrorLog>) {
    super();
  }

  catch(exception: unknown, host: ArgumentsHost) {
    this.logError(exception, host).catch(() => {
      // Logar erro não pode gerar outro erro que derruba a resposta original.
    });
    super.catch(exception, host);
  }

  private async logError(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<any>();
    if (!request) return; // exceção fora de um contexto HTTP (ex: um job agendado)

    const statusCode = exception instanceof HttpException ? exception.getStatus() : 500;
    // 5xx é sempre bug/falha de verdade. 401/403/429 é sinal de seguranca relevante (login
    // negado, IP/conta bloqueados, rate limit). O resto (400 de validação, 404, 409...) acontece
    // o tempo todo em uso normal e só inundaria a tabela sem agregar valor.
    if (statusCode < 500 && ![401, 403, 429].includes(statusCode)) return;

    const message = exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? (exception.stack || '').slice(0, 4000) : null;

    await this.errorLogRepo.save(this.errorLogRepo.create({
      statusCode,
      method: request.method,
      path: (request.originalUrl || request.url || '').slice(0, 500),
      message: message.slice(0, 2000),
      stack,
      userId: request.user?.id || request.user?.sub || null,
      tenantId: request.user?.tenantId || null,
      ipAddress: request.ip || null,
    }));
  }
}
