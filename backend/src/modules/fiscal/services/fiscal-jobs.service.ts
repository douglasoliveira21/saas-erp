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

      for (const invoice of invoices) {
        const response = await this.integration.queryStatus(invoice);
        invoice.retryCount = Number(invoice.retryCount || 0) + 1;
        if (response.configured === false) {
          invoice.queueStatus = 'pendente_integracao';
          invoice.rejectionReason = response.message;
        } else {
          invoice.queueStatus = 'processado';
          invoice.status = response.status || response.situacao || invoice.status;
          invoice.protocolNumber = response.protocolNumber || response.protocolo || invoice.protocolNumber;
          invoice.rejectionReason = response.rejectionReason || response.motivoRejeicao || invoice.rejectionReason;
        }
        await this.invoiceRepo.save(invoice);
        await this.eventRepo.save(this.eventRepo.create({
          invoiceId: invoice.id,
          type: 'job_status_sync',
          status: invoice.queueStatus,
          message: `Job fiscal executado: ${source}`,
          payload: response,
          createdBy: null,
        }));
        processed++;
      }
      return { processed, skipped: false };
    } catch (error) {
      this.logger.error('Erro no job fiscal: ' + error.message);
      return { processed, error: error.message };
    } finally {
      this.running = false;
    }
  }
}
