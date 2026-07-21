import { Injectable, Logger } from '@nestjs/common';
import * as http from 'http';
import * as https from 'https';
import { Invoice } from '../entities/invoice.entity';

@Injectable()
export class FiscalIntegrationService {
  private readonly logger = new Logger(FiscalIntegrationService.name);
  private readonly baseUrl = process.env.FISCAL_PROVIDER_URL || process.env.CIDADE360_API_URL || '';
  private readonly token = process.env.FISCAL_PROVIDER_TOKEN || process.env.CIDADE360_TOKEN || '';

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.token);
  }

  async queryStatus(invoice: Invoice): Promise<any> {
    return this.request('GET', `/invoices/${invoice.id}/status`, null, invoice);
  }

  async sendCorrectionLetter(invoice: Invoice, text: string): Promise<any> {
    return this.request('POST', `/invoices/${invoice.id}/correction-letter`, { text }, invoice);
  }

  async invalidateNumbering(payload: any): Promise<any> {
    return this.request('POST', '/numbering/invalidate', payload);
  }

  private async request(method: string, path: string, body?: any, invoice?: Invoice): Promise<any> {
    if (!this.isConfigured()) {
      return {
        configured: false,
        sent: false,
        message: 'Integração fiscal externa não configurada. Configure FISCAL_PROVIDER_URL e FISCAL_PROVIDER_TOKEN.',
        invoiceId: invoice?.id,
      };
    }

    const url = new URL(path, this.baseUrl);
    const client = url.protocol === 'https:' ? https : http;
    const bodyString = body ? JSON.stringify(body) : '';

    return new Promise((resolve, reject) => {
      const req = client.request({
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          ...(bodyString ? { 'Content-Length': Buffer.byteLength(bodyString) } : {}),
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          let parsed: any = data;
          try { parsed = data ? JSON.parse(data) : {}; } catch {}
          if ((res.statusCode || 500) >= 200 && (res.statusCode || 500) < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed?.message || parsed?.detail || `Falha fiscal externa HTTP ${res.statusCode}`));
          }
        });
      });
      req.on('error', (error) => {
        this.logger.error('Erro na integração fiscal externa: ' + error.message);
        reject(error);
      });
      if (bodyString) req.write(bodyString);
      req.end();
    });
  }
}
