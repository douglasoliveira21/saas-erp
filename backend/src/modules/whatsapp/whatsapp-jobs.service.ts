import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { WhatsappService } from './whatsapp.service';
import { runInTenant } from '../../common/tenant/tenant-context.service';

@Injectable()
export class WhatsappJobsService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappJobsService.name);
  private running = false;

  constructor(private readonly whatsappService: WhatsappService, private readonly dataSource: DataSource) {}

  onModuleInit() {
    // Testa a conexão da instância a cada 1 minuto, como pedido — mantém o status exibido em
    // Administração > WhatsApp sempre atualizado sem precisar clicar em "Testar conexão".
    setTimeout(() => this.checkConnection(), 15000);
    setInterval(() => this.checkConnection(), 60 * 1000);
  }

  async checkConnection(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      // Um tenant por vez, cada um com a própria configuração/instância do WhatsApp.
      const tenants: Array<{ tenant_id: string }> = await this.dataSource.query(`SELECT DISTINCT tenant_id FROM whatsapp_config`);
      for (const { tenant_id } of tenants) {
        await runInTenant(tenant_id, () => this.whatsappService.checkConnectionStatus()).catch((error: any) => {
          this.logger.error(`Erro ao testar conexão do WhatsApp (tenant ${tenant_id}): ` + error.message);
        });
      }
    } catch (error: any) {
      this.logger.error('Erro ao testar conexão do WhatsApp: ' + error.message);
    } finally {
      this.running = false;
    }
  }
}
