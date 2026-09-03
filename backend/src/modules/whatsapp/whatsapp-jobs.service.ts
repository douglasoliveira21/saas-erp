import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Injectable()
export class WhatsappJobsService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappJobsService.name);
  private running = false;

  constructor(private readonly whatsappService: WhatsappService) {}

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
      await this.whatsappService.checkConnectionStatus();
    } catch (error: any) {
      this.logger.error('Erro ao testar conexão do WhatsApp: ' + error.message);
    } finally {
      this.running = false;
    }
  }
}
