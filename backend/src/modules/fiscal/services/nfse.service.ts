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

@Injectable()
export class NfseService {
  private readonly logger = new Logger(NfseService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(FiscalConfig)
    private configRepository: Repository<FiscalConfig>,
    private certificateService: CertificateService,
    private auditService: AuditService,
  ) {}

  async emit(invoiceId: string, serviceData: any, certId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new BadRequestException('Nota nao encontrada');

    const config = await this.configRepository.findOne({ where: {} });
    if (!config) throw new BadRequestException('Configuracao fiscal nao encontrada. Acesse Modulo Fiscal > Configuracao e preencha os dados.');
    if (!config.cnpj) throw new BadRequestException('CNPJ nao configurado. Acesse Modulo Fiscal > Configuracao.');
    if (!config.cityCode) throw new BadRequestException('Codigo do municipio nao configurado. Acesse Modulo Fiscal > Configuracao.');

    const baseUrl = this.getBaseUrl(config);
    if (!baseUrl) throw new BadRequestException(`URL da API NFS-e (${config.environment === 1 ? 'producao' : 'homologacao'}) nao configurada. Acesse Modulo Fiscal > Configuracao e preencha o campo "URL API NFS-e${config.environment !== 1 ? ' Teste' : ''}".`);

    const agent = await this.certificateService.getHttpsAgent(certId);

    try {
      invoice.status = 'processando';
      invoice.number = config.nfseNextNumber;
      invoice.series = config.nfseSeries;
      await this.invoiceRepository.save(invoice);

      const cnpj = (config.cnpj || '').replace(/\D/g, '');
      const now = new Date();
      const dpsId = 'DPS' + cnpj.padStart(14, '0') + String(config.nfseSeries).padStart(5, '0') + String(config.nfseNextNumber).padStart(15, '0');

      // Montar XML DPS (Declaracao de Prestacao de Servicos) conforme padrao nacional
      const xml = this.buildDpsXml(config, invoice, serviceData, dpsId);
      invoice.xmlSent = xml;

      // Assinar XML com certificado A1
      const signedXml = await this.signXml(xml, certId);
      this.logger.log('XML assinado (primeiros 500 chars): ' + signedXml.substring(0, 500));
      this.logger.log('XML assinado (ultimos 200 chars): ' + signedXml.substring(signedXml.length - 200));

      // Compactar em GZip e converter para Base64
      const xmlGzipB64 = zlib.gzipSync(Buffer.from(signedXml, 'utf-8')).toString('base64');

      // Montar payload conforme API Cidade360
      const payload = {
        loteXmlGZipB64: [xmlGzipB64],
        dadosExtras: [],
      };

      // Enviar para API Cidade360 - EnviarSincrono
      const response = await this.apiRequest(baseUrl + '/EnviarSincrono', 'POST', payload, agent);

      this.logger.log('Resposta Cidade360: ' + JSON.stringify(response).substring(0, 500));

      if (response.processado && response.lote?.length > 0) {
        const item = response.lote[0];
        if (item.statusProcessamento === 'SUCESSO') {
          invoice.status = 'autorizada';
          invoice.accessKey = item.chaveAcesso || '';
          invoice.verificationCode = item.codAutenticidade || '';
          invoice.protocolNumber = response.protocolo || '';
          invoice.issuedAt = new Date();
          if (item.xmlGZipB64) {
            try {
              const xmlBuf = zlib.gunzipSync(Buffer.from(item.xmlGZipB64, 'base64'));
              invoice.xmlAuthorized = xmlBuf.toString('utf-8');
            } catch { invoice.xmlAuthorized = item.xmlGZipB64; }
          }
        } else {
          invoice.status = 'rejeitada';
          const erros = item.erros?.map((e: any) => e.codigo + ': ' + e.descricao).join('; ') || 'Erro desconhecido';
          invoice.rejectionReason = erros;
        }
      } else if (response.protocolo && !response.processado) {
        // Assincrono - salvar protocolo para consulta posterior
        invoice.status = 'processando';
        invoice.protocolNumber = response.protocolo;
        invoice.observations = 'Lote enviado. Consulte o protocolo para verificar o resultado.';
      } else {
        invoice.status = 'rejeitada';
        invoice.rejectionReason = JSON.stringify(response);
      }

      await this.invoiceRepository.save(invoice);
      await this.configRepository.update(config.id, { nfseNextNumber: config.nfseNextNumber + 1 });

      return invoice;
    } catch (e) {
      invoice.status = 'rejeitada';
      invoice.rejectionReason = e.message;
      await this.invoiceRepository.save(invoice);
      throw new BadRequestException('Erro ao emitir NFS-e: ' + e.message);
    }
  }

  async consultProtocol(protocolo: string, certId: string): Promise<any> {
    const config = await this.configRepository.findOne({ where: {} });
    const agent = await this.certificateService.getHttpsAgent(certId);
    const baseUrl = this.getBaseUrl(config);
    return this.apiRequest(baseUrl + '/ConsultarProtocolo/' + encodeURIComponent(protocolo), 'GET', null, agent);
  }

  async consult(chave: string, certId: string): Promise<any> {
    const config = await this.configRepository.findOne({ where: {} });
    const agent = await this.certificateService.getHttpsAgent(certId);
    const baseUrl = this.getBaseUrl(config);
    return this.apiRequest(baseUrl + '/ConsultarNFSe/' + encodeURIComponent(chave), 'GET', null, agent);
  }

  async queryInvoiceStatus(invoice: Invoice): Promise<any> {
    if (!invoice.certificateId) throw new BadRequestException('Nota sem certificado A1 vinculado');
    if (!invoice.accessKey && !invoice.protocolNumber) {
      throw new BadRequestException('Nota sem chave de acesso ou protocolo para consulta');
    }

    const response = invoice.accessKey
      ? await this.consult(invoice.accessKey, invoice.certificateId)
      : await this.consultProtocol(invoice.protocolNumber, invoice.certificateId);
    return this.normalizeStatusResponse(response, invoice);
  }

  async downloadPdf(chave: string, certId: string): Promise<Buffer> {
    const config = await this.configRepository.findOne({ where: {} });
    const agent = await this.certificateService.getHttpsAgent(certId);
    const baseUrl = this.getBaseUrl(config);
    const response = await this.apiRequest(baseUrl + '/DownloadPDFChave/' + encodeURIComponent(chave), 'GET', null, agent);
    if (response.pdfGZipB64) {
      return zlib.gunzipSync(Buffer.from(response.pdfGZipB64, 'base64'));
    }
    throw new BadRequestException('PDF nao disponivel: ' + JSON.stringify(response));
  }

  async downloadXmlFromApi(chave: string, certId: string): Promise<string> {
    const config = await this.configRepository.findOne({ where: {} });
    const agent = await this.certificateService.getHttpsAgent(certId);
    const baseUrl = this.getBaseUrl(config);
    const response = await this.apiRequest(baseUrl + '/ConsultarNFSe/' + encodeURIComponent(chave), 'GET', null, agent);
    if (response.notas?.length > 0 && response.notas[0].xmlGZipB64) {
      const xmlBuf = zlib.gunzipSync(Buffer.from(response.notas[0].xmlGZipB64, 'base64'));
      return xmlBuf.toString('utf-8');
    }
    throw new BadRequestException('XML nao disponivel: ' + JSON.stringify(response));
  }

  async cancel(invoiceId: string, reason: string, certId: string, userId?: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new BadRequestException('Nota nao encontrada');
    if (invoice.status !== 'autorizada') throw new BadRequestException('Apenas notas autorizadas podem ser canceladas');

    const config = await this.configRepository.findOne({ where: {} });
    const agent = await this.certificateService.getHttpsAgent(certId);
    const baseUrl = this.getBaseUrl(config);

    try {
      // Montar XML de evento de cancelamento
      const cnpj = (config.cnpj || '').replace(/\D/g, '');
      const cancelXml = this.buildCancelEventXml(invoice, cnpj, reason, config.environment);
      // Assinar XML de cancelamento com certificado
      const signedCancelXml = await this.signCancelXml(cancelXml, certId);
      const xmlGzipB64 = zlib.gzipSync(Buffer.from(signedCancelXml, 'utf-8')).toString('base64');

      const payload = { loteXmlGZipB64: [xmlGzipB64], dadosExtras: [] };
      const response = await this.apiRequest(baseUrl + '/EnviarSincrono', 'POST', payload, agent);

      if (response.processado && response.lote?.[0]?.statusProcessamento === 'SUCESSO') {
        invoice.status = 'cancelada';
        invoice.cancelReason = reason;
        invoice.cancelProtocol = response.protocolo || '';
        invoice.canceledAt = new Date();
        if (response.lote[0].xmlGZipB64) {
          try { invoice.xmlCancel = zlib.gunzipSync(Buffer.from(response.lote[0].xmlGZipB64, 'base64')).toString('utf-8'); }
          catch { invoice.xmlCancel = response.lote[0].xmlGZipB64; }
        }
      } else {
        const erros = response.lote?.[0]?.erros?.map((e: any) => e.descricao).join('; ') || JSON.stringify(response);
        throw new Error(erros);
      }

      const saved = await this.invoiceRepository.save(invoice);
      await this.auditService.safeCreate({
        userId,
        action: 'fiscal.nfse_cancelled',
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
      throw new BadRequestException('Erro ao cancelar: ' + e.message);
    }
  }

  private async signXml(xml: string, certId: string): Promise<string> {
    const { pfx, password } = await this.certificateService.getPfxBuffer(certId);

    // Extrair chave privada e certificado do PFX
    const asn1 = forge.asn1.fromDer(pfx.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

    // Obter chave privada
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
    if (!keyBag || keyBag.length === 0) throw new BadRequestException('Chave privada nao encontrada no certificado');
    const privateKeyPem = forge.pki.privateKeyToPem(keyBag[0].key);

    // Obter certificado
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag];
    if (!certBag || certBag.length === 0) throw new BadRequestException('Certificado nao encontrado no PFX');
    const certPem = forge.pki.certificateToPem(certBag[0].cert);

    // Limpar XML (sem quebras de linha) e remover declaracao XML
    let cleanXml = xml.replace(/>\s+</g, '><').replace(/\n/g, '').replace(/\r/g, '').trim();
    cleanXml = cleanXml.replace(/<\?xml[^?]*\?>/g, '').trim();

    // Extrair o Id do infDPS para referencia
    const idMatch = cleanXml.match(/Id="([^"]+)"/);
    const refId = idMatch ? idMatch[1] : '';

    // Assinar com xml-crypto
    const certBase64 = certPem.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\s/g, '');

    const sig = new SignedXml({
      privateKey: privateKeyPem,
      canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
      getKeyInfoContent: () => `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`,
    } as any);

    sig.addReference({
      xpath: `//*[@Id='${refId}']`,
      digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
    });

    sig.computeSignature(cleanXml, {
      prefix: '',
      location: { reference: `//*[local-name()='DPS']`, action: 'append' },
    });

    let result = sig.getSignedXml();
    // Garantir que nao tem declaracao XML
    result = result.replace(/<\?xml[^?]*\?>/g, '').trim();
    return result;
  }

  private buildDpsXml(config: FiscalConfig, invoice: Invoice, serviceData: any, dpsId: string): string {
    const cnpj = (config.cnpj || '').replace(/\D/g, '').padStart(14, '0');
    const recipientDoc = (invoice.recipientCnpj || '').replace(/\D/g, '');
    const now = new Date();
    // Converter para horário de Brasília (UTC-3)
    const brDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const dhEmi = `${brDate.getUTCFullYear()}-${pad(brDate.getUTCMonth()+1)}-${pad(brDate.getUTCDate())}T${pad(brDate.getUTCHours())}:${pad(brDate.getUTCMinutes())}:${pad(brDate.getUTCSeconds())}-03:00`;
    const dCompet = `${brDate.getUTCFullYear()}-${pad(brDate.getUTCMonth()+1)}-${pad(brDate.getUTCDate())}`;
    const valor = Number(invoice.totalValue).toFixed(2);
    const taxDetails = invoice.taxDetails || {};
    const iss = taxDetails.iss || {};
    const pisCofins = taxDetails.pisCofins || {};
    const ibsCbs = taxDetails.ibsCbs || {};
    const aliqFormatted = Number(iss.rate ?? serviceData?.aliquota ?? 5).toFixed(2);
    let codTribNac = serviceData?.codTribNacional || '010701';
    codTribNac = codTribNac.replace(/\D/g, '').slice(0, 6);

    const im = config.cityRegistration || '000000';
    const serie = String(config.nfseSeries).padStart(5, '0');
    const nDPS = String(config.nfseNextNumber).padStart(15, '0');

    // TSIdDPS: DPS + cLocEmi(7) + tpInsc(1:CPF=1,CNPJ=2) + doc(14) + serie(5) + nDPS(15) = 45 chars total
    const nDPSPad = String(config.nfseNextNumber).padStart(15, '0');
    const idDps = 'DPS' + config.cityCode + '2' + cnpj + serie + nDPSPad;

    // Dados do tomador (endereco do cliente)
    const tomaAddress = serviceData?.recipientAddress || '';
    const tomaCep = (serviceData?.recipientCep || '').replace(/\D/g, '');
    const tomaNeighborhood = serviceData?.recipientNeighborhood || 'Centro';
    const tomaCity = serviceData?.recipientCity || '';
    const tomaEmail = serviceData?.recipientEmail || '';

    // Separar logradouro e numero
    const addressParts = tomaAddress.split(',').map((s: string) => s.trim());
    const xLgr = addressParts[0] || 'Endereco';
    const nro = addressParts[1] || '0';

    // Montar bloco endereco do tomador (obrigatorio para CNPJ)
    let tomaEndBlock = '';
    if (recipientDoc.length === 14) {
      tomaEndBlock = `<end><endNac><cMun>${config.cityCode}</cMun><CEP>${tomaCep || '32010000'}</CEP></endNac><xLgr>${this.escapeXml(xLgr)}</xLgr><nro>${this.escapeXml(nro)}</nro><xBairro>${this.escapeXml(tomaNeighborhood)}</xBairro></end>`;
    }

    // Montar bloco email do tomador (opcional)
    const tomaEmailBlock = tomaEmail ? `<email>${this.escapeXml(tomaEmail)}</email>` : '';
    const pisCofinsBlock = pisCofins.enabled
      ? `<tribFed><piscofins><CST>${pisCofins.cst}</CST><vBCPisCofins>${Number(pisCofins.base).toFixed(2)}</vBCPisCofins><pAliqPis>${Number(pisCofins.pisRate).toFixed(2)}</pAliqPis><pAliqCofins>${Number(pisCofins.cofinsRate).toFixed(2)}</pAliqCofins><vPis>${Number(pisCofins.pisValue).toFixed(2)}</vPis><vCofins>${Number(pisCofins.cofinsValue).toFixed(2)}</vCofins><tpRetPisCofins>${pisCofins.retentionType}</tpRetPisCofins></piscofins>${Number(pisCofins.retainedSocialContributions || 0) > 0 ? `<vRetCSLL>${Number(pisCofins.retainedSocialContributions).toFixed(2)}</vRetCSLL>` : ''}</tribFed>`
      : '';
    const ibsCbsBlock = ibsCbs.enabled
      ? `<IBSCBS><finNFSe>${ibsCbs.purpose}</finNFSe><indFinal>${ibsCbs.finalConsumer}</indFinal><cIndOp>${ibsCbs.operationIndicator}</cIndOp><indDest>${ibsCbs.destinationIndicator || '0'}</indDest><valores><trib><gIBSCBS><CST>${ibsCbs.cst}</CST><cClassTrib>${ibsCbs.taxClassification}</cClassTrib></gIBSCBS></trib></valores></IBSCBS>`
      : '';

    return `<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infDPS Id="${idDps}"><tpAmb>${config.environment}</tpAmb><dhEmi>${dhEmi}</dhEmi><verAplic>VGON-ERP-1.0</verAplic><serie>${config.nfseSeries}</serie><nDPS>${config.nfseNextNumber}</nDPS><dCompet>${dCompet}</dCompet><tpEmit>1</tpEmit><cLocEmi>${config.cityCode}</cLocEmi><prest><CNPJ>${cnpj}</CNPJ><IM>${im}</IM><regTrib><opSimpNac>3</opSimpNac><regApTribSN>1</regApTribSN><regEspTrib>0</regEspTrib></regTrib></prest><toma>${recipientDoc.length === 14 ? '<CNPJ>' + recipientDoc + '</CNPJ>' : '<CPF>' + recipientDoc.padStart(11, '0') + '</CPF>'}<xNome>${this.escapeXml(invoice.recipientName || '')}</xNome>${tomaEndBlock}${tomaEmailBlock}</toma><serv><locPrest><cLocPrestacao>${config.cityCode}</cLocPrestacao></locPrest><cServ><cTribNac>${codTribNac}</cTribNac><xDescServ>${this.escapeXml(serviceData?.discriminacao || 'Servicos de informatica')}</xDescServ></cServ></serv><valores><vServPrest><vServ>${valor}</vServ></vServPrest><trib><tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>${iss.retentionType || '1'}</tpRetISSQN><pAliq>${aliqFormatted}</pAliq></tribMun>${pisCofinsBlock}<totTrib><indTotTrib>0</indTotTrib></totTrib></trib></valores>${ibsCbsBlock}</infDPS></DPS>`;
  }

  private escapeXml(value: string): string {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  private buildCancelEventXml(invoice: Invoice, cnpj: string, reason: string, tpAmb: number): string {
    const now = new Date();
    const brDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const dhEvento = `${brDate.getUTCFullYear()}-${pad(brDate.getUTCMonth()+1)}-${pad(brDate.getUTCDate())}T${pad(brDate.getUTCHours())}:${pad(brDate.getUTCMinutes())}:${pad(brDate.getUTCSeconds())}-03:00`;
    // TSIdPedRegEvt: PRE + chNFSe(50) + tpEvento(6) = 59 chars (pattern: PRE[0-9]{56})
    const chNFSe = (invoice.accessKey || '').replace(/\D/g, '').slice(0, 50);
    const eventId = 'PRE' + chNFSe + '101101';
    return `<pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infPedReg Id="${eventId}"><tpAmb>${tpAmb}</tpAmb><verAplic>VGON-ERP-1.0</verAplic><dhEvento>${dhEvento}</dhEvento><CNPJAutor>${cnpj}</CNPJAutor><chNFSe>${chNFSe}</chNFSe><e101101><xDesc>Cancelamento de NFS-e</xDesc><cMotivo>9</cMotivo><xMotivo>${reason}</xMotivo></e101101></infPedReg></pedRegEvento>`;
  }

  private async signCancelXml(xml: string, certId: string): Promise<string> {
    const { pfx, password } = await this.certificateService.getPfxBuffer(certId);

    const asn1 = forge.asn1.fromDer(pfx.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
    if (!keyBag || keyBag.length === 0) throw new BadRequestException('Chave privada nao encontrada no certificado');
    const privateKeyPem = forge.pki.privateKeyToPem(keyBag[0].key);

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag];
    if (!certBag || certBag.length === 0) throw new BadRequestException('Certificado nao encontrado no PFX');
    const certPem = forge.pki.certificateToPem(certBag[0].cert);

    let cleanXml = xml.replace(/>\s+</g, '><').replace(/\n/g, '').replace(/\r/g, '').trim();
    cleanXml = cleanXml.replace(/<\?xml[^?]*\?>/g, '').trim();

    const idMatch = cleanXml.match(/Id="([^"]+)"/);
    const refId = idMatch ? idMatch[1] : '';

    const certBase64 = certPem.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\s/g, '');

    const sig = new SignedXml({
      privateKey: privateKeyPem,
      canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
      getKeyInfoContent: () => `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`,
    } as any);

    sig.addReference({
      xpath: `//*[@Id='${refId}']`,
      digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
    });

    sig.computeSignature(cleanXml, {
      prefix: '',
      location: { reference: `//*[local-name()='infPedReg']`, action: 'after' },
    });

    let result = sig.getSignedXml();
    result = result.replace(/<\?xml[^?]*\?>/g, '').trim();

    this.logger.log('Cancel XML final (primeiros 500): ' + result.substring(0, 500));
    return result;
  }

  private apiRequest(url: string, method: string, body: any, agent: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options: any = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method,
        agent,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: string) => data += chunk);
        res.on('end', () => {
          let parsed: any;
          try { parsed = data ? JSON.parse(data) : {}; }
          catch { parsed = { raw: data }; }

          if ((res.statusCode || 500) < 200 || (res.statusCode || 500) >= 300) {
            const detail = parsed?.detail || parsed?.message || parsed?.title || parsed?.raw || `HTTP ${res.statusCode}`;
            reject(new Error(`Cidade360 respondeu ${res.statusCode}: ${detail}`));
            return;
          }
          resolve(parsed);
        });
      });

      req.on('error', reject);
      if (body) {
        const bodyStr = JSON.stringify(body);
        req.setHeader('Content-Length', Buffer.byteLength(bodyStr));
        req.write(bodyStr);
      }
      req.end();
    });
  }

  private getBaseUrl(config: FiscalConfig): string {
    if (!config) throw new BadRequestException('Configuracao fiscal nao encontrada');
    const configuredUrl = config.environment === 1
      ? (config.nfseApiUrl || process.env.CIDADE360_API_URL)
      : (config.nfseTestUrl || process.env.CIDADE360_TEST_API_URL);
    if (!configuredUrl) {
      throw new BadRequestException(`URL da API NFS-e (${config.environment === 1 ? 'producao' : 'homologacao'}) nao configurada`);
    }

    const normalized = configuredUrl.trim().replace(/\/+$/, '');
    return /\/NotaNacional$/i.test(normalized) ? normalized : normalized + '/NotaNacional';
  }

  private normalizeStatusResponse(response: any, invoice: Invoice): any {
    const item = response?.lote?.[0] || response?.notas?.[0] || response?.nota || response;
    const rawStatus = String(
      item?.situacao || item?.status || item?.statusProcessamento || response?.situacao || response?.status || '',
    ).toUpperCase();
    const errors = item?.erros || response?.erros || [];
    const rejectionReason = Array.isArray(errors) && errors.length
      ? errors.map((error: any) => `${error.codigo || ''}${error.codigo ? ': ' : ''}${error.descricao || error.mensagem || ''}`).join('; ')
      : undefined;

    let status = invoice.status;
    if (/CANCEL/.test(rawStatus)) status = 'cancelada';
    else if (/SUCESSO|AUTORIZ|ATIVA|EMITIDA/.test(rawStatus)) status = 'autorizada';
    else if (/REJEIT|ERRO|NEGAD/.test(rawStatus)) status = 'rejeitada';
    else if (/PROCESS|PENDENTE|RECEBID/.test(rawStatus)) status = 'processando';

    return {
      configured: true,
      provider: 'cidade360',
      status,
      situacao: rawStatus || status,
      protocolo: response?.protocolo || item?.protocolo || invoice.protocolNumber,
      accessKey: item?.chaveAcesso || item?.chNFSe || invoice.accessKey,
      verificationCode: item?.codAutenticidade || item?.codigoVerificacao || invoice.verificationCode,
      rejectionReason,
      raw: response,
    };
  }
}
