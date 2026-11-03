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
    if (!invoice.accessKey) {
      // Rejeições síncronas não possuem chave de acesso. Preserve o motivo já
      // retornado pela SEFAZ em vez de transformar a nota em erro de consulta.
      return {
        configured: true,
        status: invoice.status || 'rejeitada',
        rejectionReason: invoice.rejectionReason || 'NF-e rejeitada sem chave de acesso.',
        message: invoice.rejectionReason || 'NF-e rejeitada sem chave de acesso.',
      };
    }

    return this.nfeService.consult(invoice.accessKey, invoice.certificateId);
  }

  async sendCorrectionLetter(invoice: Invoice, text: string, userId?: string): Promise<any> {
    if (invoice.type === 'nfse') {
      return {
        configured: false,
        sent: false,
        message: 'A Cidade360 nao oferece carta de correcao para NFS-e neste fluxo. Cancele e reemita a nota quando a correcao alterar dados fiscais.',
      };
    }

    return this.nfeService.correctionLetter(invoice.id, text, invoice.certificateId, userId);
  }

  async invalidateNumbering(payload: any, userId?: string): Promise<any> {
    if (!payload.certId) throw new BadRequestException('Certificado A1 obrigatorio');
    return this.nfeService.invalidateNumbering(payload, payload.certId, userId);
  }
}
