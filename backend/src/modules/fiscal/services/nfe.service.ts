import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as https from 'https';
import * as zlib from 'zlib';
import * as forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import { Invoice } from '../entities/invoice.entity';
import { FiscalConfig } from '../entities/fiscal-config.entity';
import { CertificateService } from './certificate.service';
import { AuditService } from '../../audit/audit.service';

const SEFAZ_MG_PROD = {
  NFeAutorizacao4: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4',
  NFeRetAutorizacao4: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeRetAutorizacao4',
  NFeConsultaProtocolo4: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4',
  NFeInutilizacao4: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeInutilizacao4',
  NFeRecepcaoEvento4: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeRecepcaoEvento4',
  NFeStatusServico4: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeStatusServico4',
};

const SEFAZ_MG_HOM = {
  NFeAutorizacao4: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4',
  NFeRetAutorizacao4: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeRetAutorizacao4',
  NFeConsultaProtocolo4: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4',
  NFeInutilizacao4: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeInutilizacao4',
  NFeRecepcaoEvento4: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeRecepcaoEvento4',
  NFeStatusServico4: 'https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeStatusServico4',
};

// NFC-e MG
const NFCE_MG_PROD = {
  NFeAutorizacao4: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeAutorizacao4',
  NFeRetAutorizacao4: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeRetAutorizacao4',
  NFeConsultaProtocolo4: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeConsultaProtocolo4',
  NFeRecepcaoEvento4: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeRecepcaoEvento4',
  NFeStatusServico4: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeStatusServico4',
  NFeInutilizacao4: 'https://nfce.fazenda.mg.gov.br/nfce/services/NFeInutilizacao4',
  qrCodeUrl: 'https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml',
  urlChave: 'https://portalsped.fazenda.mg.gov.br/portalnfce',
};

const NFCE_MG_HOM = {
  NFeAutorizacao4: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeAutorizacao4',
  NFeRetAutorizacao4: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeRetAutorizacao4',
  NFeConsultaProtocolo4: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeConsultaProtocolo4',
  NFeInutilizacao4: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeInutilizacao4',
  NFeRecepcaoEvento4: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeRecepcaoEvento4',
  NFeStatusServico4: 'https://hnfce.fazenda.mg.gov.br/nfce/services/NFeStatusServico4',
  qrCodeUrl: 'https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml',
  urlChave: 'https://hportalsped.fazenda.mg.gov.br/portalnfce',
};

@Injectable()
export class NfeService {
  private readonly logger = new Logger(NfeService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(FiscalConfig)
    private configRepository: Repository<FiscalConfig>,
    private certificateService: CertificateService,
    private auditService: AuditService,
  ) {}

  private getEndpoints(config: FiscalConfig, modelo: string) {
    if (modelo === '65') return config.environment === 1 ? NFCE_MG_PROD : NFCE_MG_HOM;
    return config.environment === 1 ? SEFAZ_MG_PROD : SEFAZ_MG_HOM;
  }

  async checkStatus(certId: string): Promise<any> {
    const config = await this.configRepository.findOne({ where: {} });
    if (!config) {
      return { success: false, error: 'Configuração fiscal não encontrada. Acesse a aba Configuração e preencha os dados.' };
    }

    if (!certId) {
      return { success: false, error: 'Nenhum certificado digital selecionado. Faça upload de um certificado .pfx primeiro.' };
    }

    let agent: any;
    try {
      agent = await this.certificateService.getHttpsAgent(certId);
    } catch (e) {
      return { success: false, error: 'Erro ao carregar certificado: ' + e.message };
    }

    const endpoints = this.getEndpoints(config, '55');
    const tpAmb = config.environment;

    const xml = `<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${tpAmb}</tpAmb><cUF>31</cUF><xServ>STATUS</xServ></consStatServ>`;
    const envelope = this.buildSoapEnvelope(xml, 'NFeStatusServico4');

    try {
      const response = await this.soapRequest(endpoints.NFeStatusServico4, envelope, agent);
      const cStatMatch = response.match(/<cStat>(\d+)<\/cStat>/);
      const xMotivoMatch = response.match(/<xMotivo>([^<]+)<\/xMotivo>/);
      return {
        success: cStatMatch?.[1] === '107',
        cStat: cStatMatch?.[1],
        xMotivo: xMotivoMatch?.[1],
        response: response.substring(0, 500),
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async emit(invoiceId: string, saleData: any, certId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new BadRequestException('Nota nao encontrada');

    const config = await this.configRepository.findOne({ where: {} });
    if (!config) throw new BadRequestException('Configuracao fiscal nao encontrada');
    if (!config.stateRegistration) throw new BadRequestException('Inscricao Estadual nao configurada');

    const agent = await this.certificateService.getHttpsAgent(certId);
    const modelo = saleData?.modelo || '55';
    const endpoints = this.getEndpoints(config, modelo);
    const tpAmb = config.environment;

    // Validar items
    if (!saleData?.items || saleData.items.length === 0) {
      throw new BadRequestException('NF-e requer pelo menos 1 item/produto. Vincule a uma venda com itens.');
    }

    try {
      invoice.status = 'processando';
      await this.invoiceRepository.save(invoice);

      // Determinar serie e numero
      const isNfce = modelo === '65';
      const series = isNfce ? (config.nfceSeries || 1) : config.nfeSeries;
      const number = isNfce ? (config.nfceNextNumber || 1) : config.nfeNextNumber;
      invoice.number = number;
      invoice.series = series;

      // Gerar chave de acesso
      const accessKey = this.generateAccessKey(config, number, series, modelo);
      invoice.accessKey = accessKey;

      // Montar XML NF-e/NFC-e 4.00
      const xml = this.buildNfeXml(config, invoice, saleData, accessKey, modelo);

      // Assinar XML
      let finalXml = xml;
      
      // Para NFC-e, adicionar infNFeSupl ANTES de assinar (fica entre </infNFe> e antes de </NFe>)
      // O schema TNFe exige: infNFe + infNFeSupl? + Signature
      if (isNfce) {
        const qrCodeData = this.buildQrCode(config, accessKey, '');
        const infNFeSupl = `<infNFeSupl><qrCode><![CDATA[${qrCodeData.qrCode}]]></qrCode><urlChave>${qrCodeData.urlChave}</urlChave></infNFeSupl>`;
        // Inserir infNFeSupl após </infNFe> mas antes de </NFe>
        finalXml = finalXml.replace('</infNFe></NFe>', `</infNFe>${infNFeSupl}</NFe>`);
      }
      
      let signedXml = await this.signNfeXml(finalXml, certId);
      
      invoice.xmlSent = signedXml;

      // Montar lote e enviar
      const loteId = String(Math.floor(Math.random() * 999999999) + 1);
      const nfeLote = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${loteId}</idLote><indSinc>1</indSinc>${signedXml}</enviNFe>`;
      const envelope = this.buildSoapEnvelope(nfeLote, 'NFeAutorizacao4');

      // Salvar lote para debug
      invoice.observations = envelope.substring(0, 800);
      await this.invoiceRepository.save(invoice);

      this.logger.log('Enviando NF-e para SEFAZ... Modelo: ' + modelo + ' Numero: ' + number);
      this.logger.log('Lote XML (primeiros 800): ' + nfeLote.substring(0, 800));
      const response = await this.soapRequest(endpoints.NFeAutorizacao4, envelope, agent);
      this.logger.log('Resposta SEFAZ completa: ' + response);

      // Salvar resposta completa para debug
      invoice.xmlAuthorized = response;
      await this.invoiceRepository.save(invoice);
      this.logger.log('Resposta SEFAZ (500 chars): ' + response.substring(0, 500));

      // Processar resposta
      const cStatLote = this.extractTag(response, 'cStat');
      const xMotivoLote = this.extractTag(response, 'xMotivo');

      if (cStatLote === '104') {
        // Lote processado - verificar protocolo
        const cStatProt = this.extractFromBlock(response, 'protNFe', 'cStat');
        const xMotivoProt = this.extractFromBlock(response, 'protNFe', 'xMotivo');
        const nProt = this.extractFromBlock(response, 'protNFe', 'nProt');

        if (cStatProt === '100') {
          // Autorizada
          invoice.status = 'autorizada';
          invoice.protocolNumber = nProt || '';
          invoice.issuedAt = new Date();
          // Montar procNFe (NF-e + protocolo)
          const protBlock = this.extractBlock(response, 'protNFe');
          if (protBlock) {
            invoice.xmlAuthorized = `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${signedXml}${protBlock}</nfeProc>`;
          }
        } else {
          invoice.status = 'rejeitada';
          invoice.rejectionReason = `${cStatProt}: ${xMotivoProt}`;
        }
      } else if (cStatLote === '103') {
        // Lote em processamento - consultar recibo
        const nRec = this.extractTag(response, 'nRec');
        if (nRec) {
          await this.delay(3000);
          const retorno = await this.consultRecibo(nRec, endpoints, agent, tpAmb);
          const cStatRet = this.extractFromBlock(retorno, 'protNFe', 'cStat');
          const xMotivoRet = this.extractFromBlock(retorno, 'protNFe', 'xMotivo');
          const nProtRet = this.extractFromBlock(retorno, 'protNFe', 'nProt');

          if (cStatRet === '100') {
            invoice.status = 'autorizada';
            invoice.protocolNumber = nProtRet || '';
            invoice.issuedAt = new Date();
            const protBlock = this.extractBlock(retorno, 'protNFe');
            if (protBlock) {
              invoice.xmlAuthorized = `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${signedXml}${protBlock}</nfeProc>`;
            }
          } else {
            invoice.status = 'rejeitada';
            invoice.rejectionReason = `${cStatRet}: ${xMotivoRet}`;
          }
        } else {
          invoice.status = 'rejeitada';
          invoice.rejectionReason = `Lote em processamento sem recibo: ${xMotivoLote}`;
        }
      } else {
        invoice.status = 'rejeitada';
        invoice.rejectionReason = `${cStatLote}: ${xMotivoLote}`;
      }

      await this.invoiceRepository.save(invoice);

      // Incrementar numero
      if (isNfce) {
        await this.configRepository.update(config.id, { nfceNextNumber: number + 1 });
      } else {
        await this.configRepository.update(config.id, { nfeNextNumber: number + 1 });
      }

      return invoice;
    } catch (e) {
      invoice.status = 'rejeitada';
      invoice.rejectionReason = e.message;
      await this.invoiceRepository.save(invoice);
      throw new BadRequestException('Erro ao emitir NF-e: ' + e.message);
    }
  }

  private async consultRecibo(nRec: string, endpoints: any, agent: any, tpAmb: number): Promise<string> {
    const xml = `<consReciNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${tpAmb}</tpAmb><nRec>${nRec}</nRec></consReciNFe>`;
    const envelope = this.buildSoapEnvelope(xml, 'NFeRetAutorizacao4');
    return this.soapRequest(endpoints.NFeRetAutorizacao4, envelope, agent);
  }

  async cancel(invoiceId: string, reason: string, certId: string, userId?: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new BadRequestException('Nota nao encontrada');
    if (invoice.status !== 'autorizada') throw new BadRequestException('Apenas notas autorizadas podem ser canceladas');
    if (!reason || reason.length < 15) throw new BadRequestException('Motivo deve ter no minimo 15 caracteres');
    if (!invoice.protocolNumber) throw new BadRequestException('Nota sem protocolo de autorizacao');

    const config = await this.configRepository.findOne({ where: {} });
    const agent = await this.certificateService.getHttpsAgent(certId);
    // Detectar modelo pela chave de acesso (posições 20-21 = modelo 55 ou 65)
    const modelo = invoice.accessKey ? invoice.accessKey.substring(20, 22) : '55';
    const endpoints = this.getEndpoints(config, modelo);
    const tpAmb = config.environment;
    const cnpj = (config.cnpj || '').replace(/\D/g, '');
    const chNFe = invoice.accessKey;

    try {
      const now = new Date();
      const brDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      const dhEvento = `${brDate.getUTCFullYear()}-${pad(brDate.getUTCMonth()+1)}-${pad(brDate.getUTCDate())}T${pad(brDate.getUTCHours())}:${pad(brDate.getUTCMinutes())}:${pad(brDate.getUTCSeconds())}-03:00`;
      const nSeqEvento = '1';
      const eventId = 'ID110111' + chNFe + '01';

      const eventXml = `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><infEvento Id="${eventId}"><cOrgao>31</cOrgao><tpAmb>${tpAmb}</tpAmb><CNPJ>${cnpj}</CNPJ><chNFe>${chNFe}</chNFe><dhEvento>${dhEvento}</dhEvento><tpEvento>110111</tpEvento><nSeqEvento>${nSeqEvento}</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Cancelamento</descEvento><nProt>${invoice.protocolNumber}</nProt><xJust>${reason}</xJust></detEvento></infEvento></evento>`;

      // Assinar evento
      const signedEvent = await this.signEventXml(eventXml, certId);

      // Enviar
      const envEvento = `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>${Date.now()}</idLote>${signedEvent}</envEvento>`;
      const envelope = this.buildSoapEnvelope(envEvento, 'NFeRecepcaoEvento4');
      const response = await this.soapRequest(endpoints.NFeRecepcaoEvento4, envelope, agent);

      this.logger.log('Resposta cancelamento: ' + response.substring(0, 500));

      const cStat = this.extractFromBlock(response, 'retEvento', 'cStat') || this.extractTag(response, 'cStat');
      const xMotivo = this.extractFromBlock(response, 'retEvento', 'xMotivo') || this.extractTag(response, 'xMotivo');

      if (cStat === '135' || cStat === '155') {
        invoice.status = 'cancelada';
        invoice.cancelReason = reason;
        invoice.canceledAt = new Date();
        invoice.cancelProtocol = this.extractFromBlock(response, 'retEvento', 'nProt') || '';
        invoice.xmlCancel = response;
      } else {
        throw new Error(`${cStat}: ${xMotivo}`);
      }

      const saved = await this.invoiceRepository.save(invoice);
      await this.auditService.safeCreate({
        userId,
        action: 'fiscal.nfe_cancelled',
        entity: 'invoice',
        entityId: saved.id,
        newData: {
          status: saved.status,
          reason,
          cancelProtocol: saved.cancelProtocol,
          accessKey: saved.accessKey,
        },
      });
      return saved;
    } catch (e) {
      throw new BadRequestException('Erro ao cancelar NF-e: ' + e.message);
    }
  }

  async consult(accessKey: string, certId: string): Promise<any> {
    const config = await this.configRepository.findOne({ where: {} });
    const agent = await this.certificateService.getHttpsAgent(certId);
    const modelo = accessKey?.substring(20, 22) || '55';
    const endpoints = this.getEndpoints(config, modelo);
    const tpAmb = config.environment;

    const xml = `<consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${accessKey}</chNFe></consSitNFe>`;
    const envelope = this.buildSoapEnvelope(xml, 'NFeConsultaProtocolo4');

    try {
      const response = await this.soapRequest(endpoints.NFeConsultaProtocolo4, envelope, agent);
      const cStat = this.extractTag(response, 'cStat');
      const xMotivo = this.extractTag(response, 'xMotivo');
      const nProt = this.extractTag(response, 'nProt');
      const status = ['100', '150'].includes(cStat) ? 'autorizada'
        : ['101', '151', '155'].includes(cStat) ? 'cancelada'
        : ['110', '301', '302'].includes(cStat) ? 'denegada'
        : cStat === '217' ? 'nao_encontrada' : 'processando';
      return { configured: true, provider: 'sefaz', status, cStat, xMotivo, nProt, protocolNumber: nProt, raw: response.substring(0, 4000) };
    } catch (e) {
      throw new BadRequestException('Erro ao consultar: ' + e.message);
    }
  }

  async correctionLetter(invoiceId: string, text: string, certId: string, userId?: string): Promise<any> {
    const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
    if (!invoice || invoice.type !== 'nfe' || invoice.status !== 'autorizada') throw new BadRequestException('NF-e autorizada nao encontrada');
    if (!text || text.length < 15 || text.length > 1000) throw new BadRequestException('Correcao deve ter entre 15 e 1000 caracteres');
    const config = await this.configRepository.findOne({ where: {} });
    const agent = await this.certificateService.getHttpsAgent(certId);
    const endpoints = this.getEndpoints(config, '55');
    const sequence = invoice.correctionProtocol ? 2 : 1;
    const dhEvento = this.eventDate();
    const eventId = `ID110110${invoice.accessKey}${String(sequence).padStart(2, '0')}`;
    const condition = 'A Carta de Correcao e disciplinada pelo paragrafo 1o-A do art. 7o do Convenio S/N, de 15 de dezembro de 1970 e pode ser utilizada para regularizacao de erro ocorrido na emissao de documento fiscal, desde que o erro nao esteja relacionado com as variaveis que determinam o valor do imposto, a correcao de dados cadastrais que implique mudanca do remetente ou do destinatario e a data de emissao ou de saida.';
    const xml = `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><infEvento Id="${eventId}"><cOrgao>31</cOrgao><tpAmb>${config.environment}</tpAmb><CNPJ>${(config.cnpj || '').replace(/\D/g, '')}</CNPJ><chNFe>${invoice.accessKey}</chNFe><dhEvento>${dhEvento}</dhEvento><tpEvento>110110</tpEvento><nSeqEvento>${sequence}</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Carta de Correcao</descEvento><xCorrecao>${this.escXml(text)}</xCorrecao><xCondUso>${this.escXml(condition)}</xCondUso></detEvento></infEvento></evento>`;
    const signed = await this.signEventXml(xml, certId);
    const envelope = this.buildSoapEnvelope(`<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>${Date.now()}</idLote>${signed}</envEvento>`, 'NFeRecepcaoEvento4');
    const response = await this.soapRequest(endpoints.NFeRecepcaoEvento4, envelope, agent);
    const cStat = this.extractFromBlock(response, 'retEvento', 'cStat') || this.extractTag(response, 'cStat');
    const reason = this.extractFromBlock(response, 'retEvento', 'xMotivo') || this.extractTag(response, 'xMotivo');
    if (!['135', '136'].includes(cStat)) throw new BadRequestException(`${cStat}: ${reason}`);
    invoice.correctionLetter = text;
    invoice.correctionProtocol = this.extractFromBlock(response, 'retEvento', 'nProt') || '';
    await this.invoiceRepository.save(invoice);
    await this.auditService.safeCreate({ userId, action: 'fiscal.nfe_correction_letter', entity: 'invoice', entityId: invoice.id, newData: { protocol: invoice.correctionProtocol, text } });
    return { configured: true, sent: true, protocol: invoice.correctionProtocol, cStat, reason, raw: response.substring(0, 4000) };
  }

  async invalidateNumbering(payload: any, certId: string, userId?: string): Promise<any> {
    const config = await this.configRepository.findOne({ where: {} });
    const model = String(payload.model || '55');
    const series = Number(payload.series);
    const start = Number(payload.startNumber);
    const end = Number(payload.endNumber || start);
    if (!['55', '65'].includes(model) || !series || !start || end < start) throw new BadRequestException('Modelo, serie ou faixa invalidos');
    if (!payload.reason || payload.reason.length < 15) throw new BadRequestException('Justificativa deve ter no minimo 15 caracteres');
    const cnpj = (config.cnpj || '').replace(/\D/g, '');
    const year = String(new Date().getFullYear()).slice(-2);
    const id = `ID31${year}${cnpj}${model}${String(series).padStart(3, '0')}${String(start).padStart(9, '0')}${String(end).padStart(9, '0')}`;
    const xml = `<inutNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><infInut Id="${id}"><tpAmb>${config.environment}</tpAmb><xServ>INUTILIZAR</xServ><cUF>31</cUF><ano>${year}</ano><CNPJ>${cnpj}</CNPJ><mod>${model}</mod><serie>${series}</serie><nNFIni>${start}</nNFIni><nNFFin>${end}</nNFFin><xJust>${this.escXml(payload.reason)}</xJust></infInut></inutNFe>`;
    const signed = await this.signGenericXml(xml, certId, id, 'infInut');
    const endpoints = this.getEndpoints(config, model);
    const agent = await this.certificateService.getHttpsAgent(certId);
    const response = await this.soapRequest(endpoints.NFeInutilizacao4, this.buildSoapEnvelope(signed, 'NFeInutilizacao4'), agent);
    const cStat = this.extractTag(response, 'cStat');
    const reason = this.extractTag(response, 'xMotivo');
    if (!['102', '563'].includes(cStat)) throw new BadRequestException(`${cStat}: ${reason}`);
    const protocol = this.extractTag(response, 'nProt');
    await this.auditService.safeCreate({ userId, action: 'fiscal.numbering_invalidated', entity: 'invoice_numbering', newData: { ...payload, protocol, cStat } });
    return { configured: true, sent: true, protocol, cStat, reason, raw: response.substring(0, 4000) };
  }

  private eventDate(): string {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}-03:00`;
  }

  // ==================== XML BUILDING ====================

  private escXml(str: string): string {
    // Remove acentos e caracteres especiais para compatibilidade com SEFAZ
    let s = (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    // Remover acentos
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return s;
  }

  private buildNfeXml(config: FiscalConfig, invoice: Invoice, saleData: any, accessKey: string, modelo: string): string {
    const cnpj = (config.cnpj || '').replace(/\D/g, '').padStart(14, '0');
    const recipientDoc = (invoice.recipientCnpj || '').replace(/\D/g, '');
    const now = new Date();
    // Converter para horário de Brasília (UTC-3)
    const brDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const dhEmi = `${brDate.getUTCFullYear()}-${pad(brDate.getUTCMonth()+1)}-${pad(brDate.getUTCDate())}T${pad(brDate.getUTCHours())}:${pad(brDate.getUTCMinutes())}:${pad(brDate.getUTCSeconds())}-03:00`;
    const tpAmb = config.environment;
    const tpNF = saleData?.tpNF || '1'; // 0=entrada, 1=saida
    const natOp = saleData?.natOp || (tpNF === '0' ? 'COMPRA' : 'VENDA');
    const isNfce = modelo === '65';

    // IDE
    let ide = `<ide><cUF>${config.ufCode}</cUF><cNF>${accessKey.slice(35, 43)}</cNF><natOp>${this.escXml(natOp)}</natOp><mod>${modelo}</mod><serie>${invoice.series}</serie><nNF>${invoice.number}</nNF><dhEmi>${dhEmi}</dhEmi>`;
    if (!isNfce) ide += `<dhSaiEnt>${dhEmi}</dhSaiEnt>`;
    ide += `<tpNF>${tpNF}</tpNF><idDest>${saleData?.idDest || '1'}</idDest><cMunFG>${config.cityCode}</cMunFG><tpImp>${isNfce ? '4' : '1'}</tpImp><tpEmis>1</tpEmis><cDV>${accessKey.slice(43)}</cDV><tpAmb>${tpAmb}</tpAmb><finNFe>${saleData?.finNFe || '1'}</finNFe><indFinal>1</indFinal><indPres>${isNfce ? '1' : (saleData?.indPres || '1')}</indPres><procEmi>0</procEmi><verProc>VGON-ERP-1.0</verProc></ide>`;

    // EMIT
    const emitCep = (config.emitCep || '').replace(/\D/g, '');
    let emit = `<emit><CNPJ>${cnpj}</CNPJ><xNome>${this.escXml(config.companyName)}</xNome>`;
    emit += `<enderEmit><xLgr>${this.escXml(config.emitAddress || 'Endereco')}</xLgr><nro>${this.escXml(config.emitNumber || 'SN')}</nro><xBairro>${this.escXml(config.emitNeighborhood || 'Centro')}</xBairro><cMun>${config.cityCode}</cMun><xMun>Contagem</xMun><UF>MG</UF><CEP>${emitCep || '32010000'}</CEP><cPais>1058</cPais><xPais>Brasil</xPais>${config.emitPhone ? '<fone>' + config.emitPhone.replace(/\D/g, '') + '</fone>' : ''}</enderEmit>`;
    emit += `<IE>${(config.stateRegistration || '').replace(/\D/g, '')}</IE><CRT>${config.taxRegime || 1}</CRT></emit>`;

    // DEST
    let dest = '';
    if (isNfce && !recipientDoc) {
      // NFC-e sem destinatario identificado - nao gera bloco dest
      dest = '';
    } else if (isNfce && recipientDoc) {
      // NFC-e com destinatario identificado (CPF ou CNPJ)
      dest = '<dest>';
      if (recipientDoc.length === 14) {
        dest += `<CNPJ>${recipientDoc}</CNPJ>`;
      } else if (recipientDoc.length === 11) {
        dest += `<CPF>${recipientDoc}</CPF>`;
      }
      dest += `<xNome>${this.escXml(invoice.recipientName || 'CONSUMIDOR')}</xNome>`;
      dest += '<indIEDest>9</indIEDest>';
      dest += '</dest>';
    } else {
      // NF-e modelo 55
      dest = '<dest>';
      if (recipientDoc.length === 14) {
        dest += `<CNPJ>${recipientDoc}</CNPJ>`;
      } else if (recipientDoc.length === 11) {
        dest += `<CPF>${recipientDoc}</CPF>`;
      }
      dest += `<xNome>${this.escXml(invoice.recipientName || 'CONSUMIDOR')}</xNome>`;
      // Endereco do destinatario (obrigatorio para NF-e mod 55)
      const destCep = (saleData?.recipientCep || '').replace(/\D/g, '');
      const destCity = saleData?.recipientCity || 'Contagem';
      const destUf = saleData?.recipientUf || 'MG';
      const destCMun = saleData?.recipientCMun || config.cityCode;
      dest += `<enderDest><xLgr>${this.escXml(saleData?.recipientAddress || 'Endereco')}</xLgr><nro>${this.escXml(saleData?.recipientNumber || 'SN')}</nro><xBairro>${this.escXml(saleData?.recipientNeighborhood || 'Centro')}</xBairro><cMun>${destCMun}</cMun><xMun>${this.escXml(destCity)}</xMun><UF>${destUf}</UF><CEP>${destCep || '32010000'}</CEP><cPais>1058</cPais><xPais>Brasil</xPais></enderDest>`;
      // indIEDest: 1=Contribuinte (tem IE), 2=Isento, 9=Nao contribuinte (CPF ou CNPJ sem IE)
      const destIE = saleData?.recipientIE || '';
      if (destIE) {
        dest += '<indIEDest>1</indIEDest>';
        dest += `<IE>${destIE.replace(/\D/g, '')}</IE>`;
      } else {
        dest += '<indIEDest>9</indIEDest>';
      }
      dest += '</dest>';
    }

    // DET (itens)
    const items = saleData?.items || [];
    let dets = '';
    let vProd = 0;
    let vTotTrib = 0;

    items.forEach((item: any, idx: number) => {
      const nItem = idx + 1;
      const vUnCom = Number(item.unitPrice || item.salePrice || 0).toFixed(2);
      const qCom = Number(item.quantity || 1);
      const vProdItem = (Number(item.unitPrice || item.salePrice || 0) * qCom).toFixed(2);
      vProd += Number(vProdItem);
      const ncm = (item.ncm || '84713012').replace(/\D/g, '').slice(0, 8).padEnd(8, '0');
      const cfop = item.cfop || (tpNF === '0' ? '1102' : '5102');
      const cean = item.ean || 'SEM GTIN';
      const unit = item.unit || 'UN';

      let det = `<det nItem="${nItem}"><prod><cProd>${item.code || item.productId || String(nItem)}</cProd><cEAN>${cean}</cEAN><xProd>${this.escXml(item.name || 'Produto')}</xProd><NCM>${ncm}</NCM>`;
      if (item.cest) det += `<CEST>${item.cest}</CEST>`;
      det += `<CFOP>${cfop}</CFOP><uCom>${unit}</uCom><qCom>${qCom.toFixed(4)}</qCom><vUnCom>${vUnCom}</vUnCom><vProd>${vProdItem}</vProd><cEANTrib>${cean}</cEANTrib><uTrib>${unit}</uTrib><qTrib>${qCom.toFixed(4)}</qTrib><vUnTrib>${vUnCom}</vUnTrib><indTot>1</indTot></prod>`;

      // Imposto - Simples Nacional (CRT=1) usa CSOSN
      det += '<imposto>';
      // ICMS - CSOSN 102 (tributada sem permissao de credito) para SN
      const csosn = item.csosn || '102';
      det += `<ICMS><ICMSSN102><orig>0</orig><CSOSN>${csosn}</CSOSN></ICMSSN102></ICMS>`;
      // PIS
      det += '<PIS><PISNT><CST>07</CST></PISNT></PIS>';
      // COFINS
      det += '<COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>';
      det += '</imposto></det>';

      dets += det;
    });

    // TOTAL
    const vNF = vProd.toFixed(2);
    let total = `<total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet><vProd>${vNF}</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc><vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>${vNF}</vNF><vTotTrib>0.00</vTotTrib></ICMSTot></total>`;

    // TRANSP
    const transp = '<transp><modFrete>9</modFrete></transp>';

    // COBR (cobrança - fatura e duplicatas/parcelas)
    let cobr = '';
    const numParcelas = Number(saleData?.installments || saleData?.parcelas) || 1;
    if (numParcelas > 0) {
      const vOrigFat = vProd > 0 ? vProd.toFixed(2) : '0.00';
      let fatBlock = `<fat><nFat>${String(invoice.number).padStart(6, '0')}</nFat><vOrig>${vOrigFat}</vOrig><vDesc>0.00</vDesc><vLiq>${vOrigFat}</vLiq></fat>`;
      
      let dupBlocks = '';
      const valorParcela = Math.floor((vProd / numParcelas) * 100) / 100;
      let totalDistribuido = 0;

      for (let i = 1; i <= numParcelas; i++) {
        // Calcular data de vencimento (parcela i = i meses a partir de hoje)
        const brNow = new Date(new Date().getTime() - 3 * 60 * 60 * 1000);
        const vencDate = new Date(brNow);
        vencDate.setUTCMonth(vencDate.getUTCMonth() + i);
        // Garantir que o dia não passe do último dia do mês
        const lastDay = new Date(vencDate.getUTCFullYear(), vencDate.getUTCMonth() + 1, 0).getDate();
        if (vencDate.getUTCDate() > lastDay) vencDate.setUTCDate(lastDay);
        
        const dVenc = `${vencDate.getUTCFullYear()}-${String(vencDate.getUTCMonth()+1).padStart(2,'0')}-${String(vencDate.getUTCDate()).padStart(2,'0')}`;
        
        // Última parcela recebe o restante (evita centavos sobrando)
        const vDup = i === numParcelas ? (vProd - totalDistribuido).toFixed(2) : valorParcela.toFixed(2);
        totalDistribuido += Number(vDup);
        
        dupBlocks += `<dup><nDup>${String(i).padStart(3, '0')}</nDup><dVenc>${dVenc}</dVenc><vDup>${vDup}</vDup></dup>`;
      }
      
      cobr = `<cobr>${fatBlock}${dupBlocks}</cobr>`;
    }

    // PAG
    const tPag = saleData?.tPag || '01'; // 01=Dinheiro
    const vPagVal = vProd > 0 ? vProd.toFixed(2) : vNF;
    let pagContent = `<tPag>${tPag}</tPag><vPag>${vPagVal}</vPag>`;
    // Para cartão crédito/débito/pix e outros eletrônicos, informar grupo card
    if (tPag === '03' || tPag === '04' || tPag === '05' || tPag === '15' || tPag === '17' || tPag === '99') {
      pagContent += '<card><tpIntegra>2</tpIntegra></card>';
    }
    const pag = `<pag><detPag>${pagContent}</detPag></pag>`;

    // INFADIC
    const infAdic = saleData?.infCpl ? `<infAdic><infCpl>${saleData.infCpl}</infCpl></infAdic>` : '';

    // Montar NFe completa (ordem: ide, emit, dest, dets, total, transp, cobr, pag, infAdic)
    const infNFe = `<infNFe versao="4.00" Id="NFe${accessKey}">${ide}${emit}${dest}${dets}${total}${transp}${cobr}${pag}${infAdic}</infNFe>`;
    return `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">${infNFe}</NFe>`;
  }

  // ==================== SIGNING ====================

  private async signNfeXml(xml: string, certId: string): Promise<string> {
    const { pfx, password } = await this.certificateService.getPfxBuffer(certId);
    const asn1 = forge.asn1.fromDer(pfx.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
    if (!keyBag || keyBag.length === 0) throw new BadRequestException('Chave privada nao encontrada');
    const privateKeyPem = forge.pki.privateKeyToPem(keyBag[0].key);

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag];
    if (!certBag || certBag.length === 0) throw new BadRequestException('Certificado nao encontrado');
    const certPem = forge.pki.certificateToPem(certBag[0].cert);

    let cleanXml = xml.replace(/>\s+</g, '><').replace(/\n/g, '').replace(/\r/g, '').trim();
    cleanXml = cleanXml.replace(/<\?xml[^?]*\?>/g, '').trim();

    const idMatch = cleanXml.match(/Id="(NFe[^"]+)"/);
    const refId = idMatch ? idMatch[1] : '';

    const certBase64 = certPem.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\s/g, '');

    const sig = new SignedXml({
      privateKey: privateKeyPem,
      canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
      getKeyInfoContent: () => `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`,
    } as any);

    sig.addReference({
      xpath: `//*[@Id='${refId}']`,
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
    });

    sig.computeSignature(cleanXml, {
      prefix: '',
      location: { reference: `//*[local-name()='NFe']`, action: 'append' },
    });

    let result = sig.getSignedXml();
    result = result.replace(/<\?xml[^?]*\?>/g, '').trim();
    return result;
  }

  private async signEventXml(xml: string, certId: string): Promise<string> {
    const { pfx, password } = await this.certificateService.getPfxBuffer(certId);
    const asn1 = forge.asn1.fromDer(pfx.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
    if (!keyBag || keyBag.length === 0) throw new BadRequestException('Chave privada nao encontrada');
    const privateKeyPem = forge.pki.privateKeyToPem(keyBag[0].key);

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag];
    if (!certBag || certBag.length === 0) throw new BadRequestException('Certificado nao encontrado');
    const certPem = forge.pki.certificateToPem(certBag[0].cert);

    let cleanXml = xml.replace(/>\s+</g, '><').replace(/\n/g, '').replace(/\r/g, '').trim();

    const idMatch = cleanXml.match(/Id="([^"]+)"/);
    const refId = idMatch ? idMatch[1] : '';

    const certBase64 = certPem.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\s/g, '');

    const sig = new SignedXml({
      privateKey: privateKeyPem,
      canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
      getKeyInfoContent: () => `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`,
    } as any);

    sig.addReference({
      xpath: `//*[@Id='${refId}']`,
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
    });

    sig.computeSignature(cleanXml, {
      prefix: '',
      location: { reference: `//*[local-name()='infEvento']`, action: 'after' },
    });

    let result = sig.getSignedXml();
    result = result.replace(/<\?xml[^?]*\?>/g, '').trim();
    return result;
  }

  private async signGenericXml(xml: string, certId: string, refId: string, elementName: string): Promise<string> {
    const { pfx, password } = await this.certificateService.getPfxBuffer(certId);
    const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfx.toString('binary')), password);
    const keyBag = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag];
    const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
    if (!keyBag?.[0]?.key || !certBag?.[0]?.cert) throw new BadRequestException('Certificado sem chave privada valida');
    const certBase64 = forge.pki.certificateToPem(certBag[0].cert).replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s/g, '');
    const sig = new SignedXml({
      privateKey: forge.pki.privateKeyToPem(keyBag[0].key),
      canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
      getKeyInfoContent: () => `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`,
    } as any);
    sig.addReference({ xpath: `//*[@Id='${refId}']`, digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1', transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'] });
    sig.computeSignature(xml, { prefix: '', location: { reference: `//*[local-name()='${elementName}']`, action: 'after' } });
    return sig.getSignedXml().replace(/<\?xml[^?]*\?>/g, '').trim();
  }

  // ==================== HELPERS ====================

  private buildQrCode(config: FiscalConfig, chave: string, signedXml: string): { qrCode: string; urlChave: string } {
    const tpAmb = config.environment;
    const cscId = String(parseInt(config.nfceCscId || '1', 10));
    const cscToken = config.nfceCscToken || '';
    const urlQrCode = (NFCE_MG_PROD as any).qrCodeUrl;
    const urlChave = (NFCE_MG_PROD as any).urlChave;

    // QR Code versão 2 (online): URL?p=chave|2|tpAmb|cIdToken|cHashQRCode
    const concat = chave + '|2|' + tpAmb + '|' + cscId + cscToken;
    const hash = require('crypto').createHash('sha1').update(concat).digest('hex').toUpperCase();
    const qrCode = `${urlQrCode}?p=${chave}|2|${tpAmb}|${cscId}|${hash}`;

    return { qrCode, urlChave };
  }

  private generateAccessKey(config: FiscalConfig, number: number, series: number, modelo: string): string {
    const now = new Date();
    const aamm = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0');
    const cnpj = (config.cnpj || '').replace(/\D/g, '').padStart(14, '0');
    const mod = modelo.padStart(2, '0');
    const serie = String(series).padStart(3, '0');
    const nNF = String(number).padStart(9, '0');
    const tpEmis = '1';
    const cNF = String(Math.floor(Math.random() * 99999999)).padStart(8, '0');

    const base = config.ufCode + aamm + cnpj + mod + serie + nNF + tpEmis + cNF;
    const dv = this.calcDV(base);
    return base + dv;
  }

  private calcDV(key: string): string {
    let weight = 2;
    let sum = 0;
    for (let i = key.length - 1; i >= 0; i--) {
      sum += parseInt(key[i]) * weight;
      weight = weight >= 9 ? 2 : weight + 1;
    }
    const rest = sum % 11;
    return rest < 2 ? '0' : String(11 - rest);
  }

  private buildSoapEnvelope(content: string, service: string): string {
    return `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/${service}">${content}</nfeDadosMsg></soap12:Body></soap12:Envelope>`;
  }

  private extractTag(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
    return match ? match[1] : '';
  }

  private extractFromBlock(xml: string, block: string, tag: string): string {
    const blockMatch = xml.match(new RegExp(`<${block}[^>]*>([\\s\\S]*?)</${block}>`));
    if (!blockMatch) return '';
    const tagMatch = blockMatch[1].match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
    return tagMatch ? tagMatch[1] : '';
  }

  private extractBlock(xml: string, block: string): string {
    const match = xml.match(new RegExp(`<${block}[^>]*>[\\s\\S]*?</${block}>`));
    return match ? match[0] : '';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private soapRequest(url: string, envelope: string, agent: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: 'POST',
        agent,
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(envelope),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: string) => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
      req.write(envelope);
      req.end();
    });
  }
}
