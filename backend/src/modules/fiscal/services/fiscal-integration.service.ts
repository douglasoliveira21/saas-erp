import { BadRequestException, Injectable } from '@nestjs/common';
import { Invoice } from '../entities/invoice.entity';
import { NfeService } from './nfe.service';
import { NfseService } from './nfse.service';

@Injectable()
export class FiscalIntegrationService {
  constructor(
    private readonly nfseService: NfseService,
    private readonly nfeService: NfeService,
  ) {}

  async queryStatus(invoice: Invoice): Promise<any> {
    if (!invoice.certificateId) {
      return {
        configured: false,
        sent: false,
        message: 'Nota sem certificado A1 vinculado.',
        invoiceId: invoice.id,
      };
    }

    if (invoice.type === 'nfse') return this.nfseService.queryInvoiceStatus(invoice);
    if (!invoice.accessKey) throw new BadRequestException('NF-e sem chave de acesso para consulta');

    const response = await this.nfeService.consult(invoice.accessKey, invoice.certificateId);
    return { configured: true, provider: 'sefaz', status: invoice.status, raw: response };
  }

  async sendCorrectionLetter(invoice: Invoice, text: string): Promise<any> {
    if (invoice.type === 'nfse') {
      return {
        configured: false,
        sent: false,
        message: 'A Cidade360 nao oferece carta de correcao para NFS-e neste fluxo. Cancele e reemita a nota quando a correcao alterar dados fiscais.',
      };
    }

    return {
      configured: false,
      sent: false,
      message: 'Evento CC-e da NF-e ainda nao possui transmissao SEFAZ implementada.',
      text,
    };
  }

  async invalidateNumbering(payload: any): Promise<any> {
    return {
      configured: false,
      sent: false,
      message: 'Inutilizacao pertence ao fluxo NF-e/NFC-e da SEFAZ e nao se aplica a NFS-e Cidade360.',
      payload,
    };
  }
}
