import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { Invoice } from '../entities/invoice.entity';
import { FiscalEvent } from '../entities/fiscal-event.entity';
import { FiscalIntegrationService } from './fiscal-integration.service';

@Injectable()
export class FiscalJobsService implements OnModuleInit {
  private readonly logger = new Logger(FiscalJobsService.name);
  private running = false;

  constructor(
    @InjectRepository(Invoice) private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(FiscalEvent) private readonly eventRepo: Repository<FiscalEvent>,
    private readonly integration: FiscalIntegrationService,
  ) {}

  onModuleInit() {
    if (process.env.FISCAL_JOBS_ENABLED === 'false') return;
    const minutes = Math.max(Number(process.env.FISCAL_JOBS_INTERVAL_MINUTES || 15), 5);
    setTimeout(() => this.run('startup'), 20000);
    setInterval(() => this.run('interval'), minutes * 60 * 1000);
  }

  async run(source = 'manual') {
    if (this.running) return { processed: 0, skipped: true };
    this.running = true;
    let processed = 0;
    try {
      const now = new Date();
      const invoices = await this.invoiceRepo.find({
        where: [
          { queueStatus: In(['pendente', 'retry']) },
          { queueStatus: 'erro', nextRetryAt: LessThanOrEqual(now) },
        ],
        take: Number(process.env.FISCAL_JOBS_BATCH_SIZE || 25),
        order: { createdAt: 'ASC' },
      });

      let errors = 0;
      for (const invoice of invoices) {
        // Cada nota e isolada num try/catch proprio: uma nota travada (ex.: falhou antes de
        // sequer obter protocolo/chave de acesso, entao nunca vai ter o que consultar) nao pode
        // derrubar o lote inteiro e impedir as outras 24 notas de serem sincronizadas neste ciclo.
        try {
          const response = await this.integration.queryStatus(invoice);
          invoice.retryCount = Number(invoice.retryCount || 0) + 1;
          if (response.configured === false) {
            invoice.queueStatus = 'pendente_integracao';
            invoice.rejectionReason = response.message;
          } else {
            invoice.queueStatus = 'processado';
            invoice.status = response.status || response.situacao || invoice.status;
            invoice.protocolNumber = response.protocolNumber || response.protocolo || invoice.protocolNumber;
            invoice.accessKey = response.accessKey || invoice.accessKey;
            invoice.verificationCode = response.verificationCode || invoice.verificationCode;
            invoice.rejectionReason = response.rejectionReason || response.motivoRejeicao || invoice.rejectionReason;
          }
          await this.invoiceRepo.save(invoice);
          if (invoice.saleId && String(invoice.status).toLowerCase() === 'autorizada') {
            await this.invoiceRepo.manager.query(`UPDATE sales SET fiscal_status='autorizada', status=CASE WHEN status='pendente' THEN 'nf_emitida' ELSE status END, updated_at=NOW() WHERE id=$1`, [invoice.saleId]);
            await this.invoiceRepo.manager.query(`UPDATE financial_tasks SET status='concluido', completed_at=COALESCE(completed_at,NOW()), observations=COALESCE(observations,'Nota autorizada pela sincronização fiscal') WHERE sale_id=$1 AND type='emissao_nf' AND status='pendente'`, [invoice.saleId]);
          }
          await this.eventRepo.save(this.eventRepo.create({
            invoiceId: invoice.id,
            type: 'job_status_sync',
            status: invoice.queueStatus,
            message: `Job fiscal executado: ${source}`,
            payload: response,
            createdBy: null,
          }));
          processed++;
        } catch (error: any) {
          errors++;
          this.logger.warn(`Nota ${invoice.id} nao pode ser sincronizada, pulando: ${error.message}`);
          // Nunca vai ter chave/protocolo pra consultar (falhou antes de enviar) — sem marcar como
          // erro com backoff, essa mesma nota seria escolhida de novo no proximo ciclo e continuaria
          // preenchendo o lote (esbarrando no batch size e sufocando as notas realmente pendentes).
          invoice.retryCount = Number(invoice.retryCount || 0) + 1;
          invoice.queueStatus = 'erro';
          invoice.rejectionReason = error.message;
          invoice.nextRetryAt = new Date(Date.now() + Math.min(invoice.retryCount, 24) * 60 * 60 * 1000);
          await this.invoiceRepo.save(invoice).catch(() => {});
        }
      }
      return { processed, errors, skipped: false };
    } catch (error) {
      this.logger.error('Erro no job fiscal: ' + error.message);
      return { processed, error: error.message };
    } finally {
      this.running = false;
    }
  }
}
