import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../entities/invoice.entity';
import { FiscalSaleDataService } from './fiscal-sale-data.service';
import { NfeService } from './nfe.service';
import { NfseService } from './nfse.service';

// Recupera os parâmetros de notas antigas emitidas por este ERP, antes do snapshot emissionInput.
function tag(xml: string, name: string): string {
  const value = xml.match(new RegExp('<(?:[\\w]+:)?' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w]+:)?' + name + '>'))?.[1] || '';
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

@Injectable()
export class FiscalReissueService {
  constructor(
    @InjectRepository(Invoice) private readonly invoices: Repository<Invoice>,
    private readonly data: FiscalSaleDataService,
    private readonly nfe: NfeService,
    private readonly nfse: NfseService,
  ) {}

  async prepare(invoice: Invoice): Promise<any> {
    if (!invoice.certificateId) throw new BadRequestException('Nota sem certificado vinculado para reemissão.');
    if (!['nfe', 'nfce', 'nfse'].includes(invoice.type)) throw new BadRequestException('Tipo de nota não suportado para reemissão automática.');
    if (invoice.taxDetails?.emissionInput) return { ...invoice.taxDetails.emissionInput };
    const xml = invoice.xmlSent || '';
    if (!xml) throw new BadRequestException('Nota antiga sem os dados de emissão. Confira os dados fiscais antes de editar o valor.');
    const recipient = tag(xml, invoice.type === 'nfse' ? 'toma' : 'dest');
    const base: any = {
      recipientAddress: tag(recipient, 'xLgr'), recipientNumber: tag(recipient, 'nro'),
      recipientNeighborhood: tag(recipient, 'xBairro'), recipientCep: tag(recipient, 'CEP'),
      recipientCity: tag(recipient, 'xMun'), recipientUf: tag(recipient, 'UF'),
      recipientCMun: tag(recipient, 'cMun'), recipientCityCode: tag(recipient, 'cMun'),
      recipientIE: tag(recipient, 'IE'), recipientEmail: tag(recipient, 'email'),
    };
    if (invoice.type === 'nfse') {
      if (!tag(xml, 'cTribNac') || !tag(xml, 'xDescServ')) throw new BadRequestException('Não foi possível recuperar os dados da NFS-e original.');
      const taxes = invoice.taxDetails || {};
      return {
        ...base, recipientAddress: [base.recipientAddress, base.recipientNumber].filter(Boolean).join(', '),
        codTribNacional: tag(xml, 'cTribNac'), discriminacao: tag(xml, 'xDescServ').split(' | Pagamento:')[0],
        competencia: tag(xml, 'dCompet'),
        aliquota: taxes.iss?.rate ?? Number(tag(xml, 'pAliq') || 0),
        issRetentionType: taxes.iss?.retentionType || tag(xml, 'tpRetISSQN') || '1',
        issBase: taxes.iss?.base ?? Number(invoice.totalValue),
        pisCofinsEnabled: taxes.pisCofins?.enabled || false,
        pisCofinsBase: taxes.pisCofins?.base ?? Number(invoice.totalValue),
        pisRate: taxes.pisCofins?.pisRate || 0, cofinsRate: taxes.pisCofins?.cofinsRate || 0,
        pisCofinsCst: taxes.pisCofins?.cst, pisCofinsRetentionType: taxes.pisCofins?.retentionType,
        csllRetainedValue: taxes.pisCofins?.retainedCsllValue || 0,
        ibsCbsEnabled: taxes.ibsCbs?.enabled || false,
        ibsCbsPurpose: taxes.ibsCbs?.purpose, ibsCbsFinalConsumer: taxes.ibsCbs?.finalConsumer,
        ibsCbsDestinationIndicator: taxes.ibsCbs?.destinationIndicator, ibsCbsOperationIndicator: taxes.ibsCbs?.operationIndicator,
        ibsCbsCst: taxes.ibsCbs?.cst, ibsCbsTaxClassification: taxes.ibsCbs?.taxClassification,
        ibsStateRate: taxes.ibsCbs?.ibsStateRate, ibsMunicipalRate: taxes.ibsCbs?.ibsMunicipalRate, cbsRate: taxes.ibsCbs?.cbsRate,
      };
    }
    const model = tag(xml, 'mod');
    if (!['55', '65'].includes(model)) throw new BadRequestException('Modelo fiscal da nota original não reconhecido.');
    return {
      ...base, modelo: model, natOp: tag(xml, 'natOp'), tpNF: tag(xml, 'tpNF'),
      idDest: tag(xml, 'idDest'), finNFe: tag(xml, 'finNFe'), indPres: tag(xml, 'indPres'), infCpl: tag(xml, 'infCpl'),
      items: [...xml.matchAll(/<det\b[^>]*>([\s\S]*?)<\/det>/g)].map(match => ({
        code: tag(match[1], 'cProd'), ncm: tag(match[1], 'NCM'), cfop: tag(match[1], 'CFOP'),
        cest: tag(match[1], 'CEST'), unit: tag(match[1], 'uCom'), ean: tag(match[1], 'cEAN'), csosn: tag(match[1], 'CSOSN'),
      })),
    };
  }

  async createReplacement(original: Invoice, template: any) {
    const input = await this.data.validateSaleForInvoice(original.saleId, original.type === 'nfse' ? 'nfse' : 'nfe', template, true);
    const ratio = Number(original.totalValue) > 0 ? Number(input.totalValue) / Number(original.totalValue) : 1;
    for (const field of ['issBase', 'pisCofinsBase', 'csllRetainedValue']) {
      if (template[field] != null) input[field] = Math.round(Number(template[field]) * ratio * 100) / 100;
    }
    if (input.discriminacao) input.discriminacao = input.discriminacao.split(' | Pagamento:')[0];
    // Recria o descritivo de pagamento com o parcelamento atual.
    const normalized = await this.data.validateSaleForInvoice(original.saleId, original.type === 'nfse' ? 'nfse' : 'nfe', input, true);
    return this.invoices.save(this.invoices.create({
      saleId: original.saleId, certificateId: original.certificateId, type: original.type,
      status: 'pendente', queueStatus: 'aguardando_envio', environment: original.environment,
      recipientCnpj: normalized.recipientCnpj, recipientName: normalized.recipientName,
      totalValue: normalized.totalValue,
      taxDetails: {
        ...(original.type === 'nfse' ? this.data.calculateNfseTaxes(normalized) : {}),
        emissionInput: normalized, replacesInvoiceId: original.id,
      },
    }));
  }

  async emitReplacement(invoice: Invoice) {
    const input = invoice.taxDetails.emissionInput;
    const result = invoice.type === 'nfse'
      ? await this.nfse.emit(invoice.id, input, invoice.certificateId)
      : await this.nfe.emit(invoice.id, input, invoice.certificateId);
    if (result.status !== 'autorizada') throw new BadRequestException(
      result.status === 'processando' ? 'Nota enviada e aguardando autorização. Consulte o módulo Fiscal antes de retomar.' :
        'A nova nota foi recusada. Confira o motivo no módulo Fiscal: ' + (result.rejectionReason || result.status),
    );
    return result;
  }
}

