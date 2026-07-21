import { BadRequestException, Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Permissions, Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CertificateService } from './services/certificate.service';
import { NfeService } from './services/nfe.service';
import { NfseService } from './services/nfse.service';
import { Invoice } from './entities/invoice.entity';
import { FiscalConfig } from './entities/fiscal-config.entity';
import { FinancialTask } from '../financial-tasks/entities/financial-task.entity';
import { FinancialMovement } from '../financial/entities/financial-movement.entity';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { FiscalEvent } from './entities/fiscal-event.entity';
import { FiscalIntegrationService } from './services/fiscal-integration.service';
import { FiscalJobsService } from './services/fiscal-jobs.service';

@Controller('fiscal')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FiscalController {
  constructor(
    private certificateService: CertificateService,
    private nfeService: NfeService,
    private nfseService: NfseService,
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    @InjectRepository(FiscalConfig) private configRepo: Repository<FiscalConfig>,
    @InjectRepository(FiscalEvent) private eventRepo: Repository<FiscalEvent>,
    @InjectRepository(FinancialTask) private taskRepo: Repository<FinancialTask>,
    @InjectRepository(FinancialMovement) private movementRepo: Repository<FinancialMovement>,
    private mailService: MailService,
    private auditService: AuditService,
    private fiscalIntegration: FiscalIntegrationService,
    private fiscalJobs: FiscalJobsService,
  ) {}

  private async completeNfTask(saleId: string) {
    if (!saleId) return;
    try {
      const task = await this.taskRepo.findOne({ where: { saleId, type: 'emissao_nf', status: 'pendente' } });
      if (task) {
        task.status = 'concluido';
        task.completedAt = new Date();
        task.observations = 'Concluido automaticamente pela emissao da nota fiscal';
        await this.taskRepo.save(task);
      }
      // Atualizar status da venda para nf_emitida se estiver pendente
      await this.invoiceRepo.manager.query(
        `UPDATE sales SET status = 'nf_emitida', updated_at = NOW() WHERE id = $1 AND status = 'pendente'`,
        [saleId]
      );
    } catch {}
  }

  // === CERTIFICADOS ===
  @Post('certificates/upload')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async uploadCertificate(@UploadedFile() file: any, @Body() body: any, @Request() req: any) {
    if (!file) throw new Error('Arquivo .pfx obrigatorio');
    return this.certificateService.upload(file.buffer, body.password, body.name || file.originalname, req.user.id);
  }

  @Get('certificates')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  getCertificates() {
    return this.certificateService.findAll();
  }

  @Delete('certificates/:id')
  @Roles(UserRole.ADMIN)
  removeCertificate(@Param('id') id: string) {
    return this.certificateService.remove(id);
  }

  @Patch('certificates/:id/toggle')
  @Roles(UserRole.ADMIN)
  toggleCertificate(@Param('id') id: string) {
    return this.certificateService.toggleActive(id);
  }

  // === CONFIGURACAO ===
  @Get('config')
  @Roles(UserRole.ADMIN)
  async getConfig() {
    const config = await this.configRepo.findOne({ where: {} });
    if (!config) {
      // Retorna objeto vazio para o frontend não quebrar
      return {
        cnpj: '',
        companyName: '',
        stateRegistration: '',
        cityRegistration: '',
        taxRegime: 1,
        nfeSeries: 1,
        nfeNextNumber: 1,
        nfseSeries: 1,
        nfseNextNumber: 1,
        environment: 2,
        ufCode: '31',
        cityCode: '3118601',
        nfseApiUrl: '',
        nfseTestUrl: '',
        emitAddress: '',
        emitNumber: '',
        emitNeighborhood: '',
        emitCep: '',
        emitPhone: '',
      };
    }
    return config;
  }

  @Patch('config')
  @Roles(UserRole.ADMIN)
  async updateConfig(@Body() body: any, @Request() req: any) {
    const config = await this.configRepo.findOne({ where: {} });
    if (!config) {
      const saved = await this.configRepo.save(this.configRepo.create(body));
      const savedConfig = Array.isArray(saved) ? saved[0] : saved;
      await this.auditService.safeCreate({
        userId: req.user?.id,
        action: 'fiscal.config_created',
        entity: 'fiscal_config',
        entityId: savedConfig.id,
        newData: savedConfig,
      });
      return savedConfig;
    }
    const oldData = { ...config };
    Object.assign(config, body);
    const saved = await this.configRepo.save(config);
    await this.auditService.safeCreate({
      userId: req.user?.id,
      action: 'fiscal.config_updated',
      entity: 'fiscal_config',
      entityId: saved.id,
      oldData,
      newData: body,
    });
    return saved;
  }

  // === NOTAS FISCAIS ===
  @Get('invoices')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  getInvoices() {
    return this.invoiceRepo.find({
      select: ['id', 'type', 'number', 'series', 'accessKey', 'protocolNumber', 'verificationCode', 'status', 'recipientName', 'recipientCnpj', 'totalValue', 'rejectionReason', 'cancelReason', 'issuedAt', 'createdAt', 'saleId', 'environment'],
      relations: ['sale', 'sale.customer'],
      order: { createdAt: 'DESC' },
    });
  }

  @Get('invoices/:id')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  getInvoice(@Param('id') id: string) {
    return this.invoiceRepo.findOne({ where: { id }, relations: ['sale', 'sale.customer', 'certificate'] });
  }

  @Get('invoices/:id/xml')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  async getInvoiceXml(@Param('id') id: string) {
    const inv = await this.invoiceRepo.findOne({ where: { id } });
    return { xmlSent: inv?.xmlSent, xmlAuthorized: inv?.xmlAuthorized, xmlCancel: inv?.xmlCancel };
  }

  @Get('invoices/:id/download-xml')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  async downloadXml(@Param('id') id: string, @Res() res: Response) {
    const inv = await this.invoiceRepo.findOne({ where: { id } });
    if (!inv) { res.status(404).json({ message: 'Nota nao encontrada' }); return; }
    const xml = inv.xmlAuthorized || inv.xmlSent || '';
    const filename = `${inv.type}_${inv.number || 'rascunho'}_serie${inv.series}.xml`;
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(xml);
  }

  @Get('invoices/:id/danfse')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  async getDanfse(@Param('id') id: string) {
    const inv = await this.invoiceRepo.findOne({ where: { id }, relations: ['sale', 'sale.customer', 'certificate'] });
    if (!inv) throw new Error('Nota nao encontrada');
    const config = await this.configRepo.findOne({ where: {} });
    return { invoice: inv, config };
  }

  // === NF-e ===
  @Post('nfe/emit')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  async emitNfe(@Body() body: { saleId: string; certId: string; saleData?: any }, @Request() req: any) {
    // Criar registro de invoice
    const invoice = this.invoiceRepo.create({
      saleId: body.saleId,
      certificateId: body.certId,
      type: 'nfe',
      status: 'pendente',
      recipientCnpj: body.saleData?.recipientCnpj,
      recipientName: body.saleData?.recipientName,
      totalValue: body.saleData?.totalValue,
    });
    const saved = await this.invoiceRepo.save(invoice);
    const result = await this.nfeService.emit(saved.id, body.saleData, body.certId);
    if (result.status === 'autorizada' && body.saleId) {
      await this.completeNfTask(body.saleId);
    }

    // Se for NF-e de entrada (compra), registrar despesa no fluxo de caixa
    const tpNF = body.saleData?.tpNF || '1';
    if (tpNF === '0' && result.status === 'autorizada' && body.saleData?.totalValue) {
      await this.movementRepo.save(
        this.movementRepo.create({
          type: 'despesa',
          category: 'compra_mercadoria',
          description: `NF-e Entrada: ${body.saleData.recipientName || 'Fornecedor'} - Nota ${result.number || ''}`,
          value: Number(body.saleData.totalValue),
          date: new Date().toISOString().split('T')[0],
          referenceId: saved.id,
          referenceType: 'nfe_entrada',
          isForecast: false,
          createdBy: req.user?.id,
        }),
      );
    }

    return result;
  }

  @Post('nfe/status')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  checkNfeStatus(@Body() body: { certId: string }) {
    return this.nfeService.checkStatus(body.certId);
  }

  @Post('nfe/consult')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  consultNfe(@Body() body: { accessKey: string; certId: string }) {
    return this.nfeService.consult(body.accessKey, body.certId);
  }

  @Post('nfe/cancel')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  async cancelNfe(@Body() body: { invoiceId: string; reason: string; certId: string }, @Request() req: any) {
    return this.nfeService.cancel(body.invoiceId, body.reason, body.certId, req.user?.id);
  }

  @Get('nfe/download-xml/:id')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  async downloadNfeXml(@Param('id') id: string, @Res() res: Response) {
    const inv = await this.invoiceRepo.findOne({ where: { id } });
    if (!inv) { res.status(404).json({ message: 'Nota nao encontrada' }); return; }
    const xml = inv.xmlAuthorized || inv.xmlSent || '';
    const filename = `NFe_${inv.number || 'rascunho'}_serie${inv.series}.xml`;
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(xml);
  }

  @Get('nfe/danfe/:id')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  async getDanfe(@Param('id') id: string) {
    const inv = await this.invoiceRepo.findOne({ where: { id }, relations: ['sale', 'sale.customer', 'sale.items'] });
    if (!inv) throw new Error('Nota nao encontrada');
    const config = await this.configRepo.findOne({ where: {} });
    return { invoice: inv, config };
  }

  // === NFS-e ===
  @Post('nfse/emit')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  async emitNfse(@Body() body: { saleId: string; certId: string; serviceData?: any }) {
    const taxDetails = this.calculateNfseTaxes(body.serviceData || {});
    const invoice = this.invoiceRepo.create({
      saleId: body.saleId,
      certificateId: body.certId,
      type: 'nfse',
      status: 'pendente',
      recipientCnpj: body.serviceData?.recipientCnpj,
      recipientName: body.serviceData?.recipientName,
      totalValue: body.serviceData?.totalValue,
      taxDetails,
    });
    const saved = await this.invoiceRepo.save(invoice);
    const result = await this.nfseService.emit(saved.id, body.serviceData, body.certId);
    if (result.status === 'autorizada' && body.saleId) {
      await this.completeNfTask(body.saleId);
      // Enviar NFS-e por email ao cliente
      if (false) try {
        const customerEmail = body.serviceData?.recipientEmail;
        if (customerEmail && result.accessKey) {
          const pdfBuffer = await this.nfseService.downloadPdf(result.accessKey, body.certId);
          const xmlContent = result.xmlAuthorized || result.xmlSent || '';
          await this.mailService.sendMailWithAttachment(customerEmail, 'Nota Fiscal de Serviço - VGON', `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #7c3aed; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0;">Nota Fiscal de Serviço</h1>
              </div>
              <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                <p>Olá ${body.serviceData?.recipientName || ''},</p>
                <p>Segue em anexo a Nota Fiscal de Serviço referente ao atendimento realizado.</p>
                <table style="width: 100%; margin: 20px 0;">
                  <tr><td style="padding: 8px; color: #6b7280;">Número:</td><td style="padding: 8px; font-weight: bold;">${result.number}</td></tr>
                  <tr><td style="padding: 8px; color: #6b7280;">Valor:</td><td style="padding: 8px; font-weight: bold; color: #059669;">R$ ${Number(result.totalValue).toFixed(2)}</td></tr>
                </table>
                <p style="color: #9ca3af; font-size: 12px; text-align: center;">VGON Soluções em Informática</p>
              </div>
            </div>
          `, [
            { filename: `NFSe_${result.number}.pdf`, content: pdfBuffer, contentType: 'application/pdf' },
            { filename: `NFSe_${result.number}.xml`, content: Buffer.from(xmlContent, 'utf-8'), contentType: 'application/xml' },
          ]);
        }
      } catch {}
    }
    return result;
  }

  private calculateNfseTaxes(serviceData: any): Record<string, any> {
    const money = (value: any) => {
      const scaled = Number(value || 0) * 100;
      const floor = Math.floor(scaled);
      const fraction = scaled - floor;
      const rounded = Math.abs(fraction - 0.5) < 1e-9 ? (floor % 2 === 0 ? floor : floor + 1) : Math.round(scaled);
      return rounded / 100;
    };
    const rate = (value: any) => {
      const parsed = Number(value || 0);
      if (!Number.isFinite(parsed)) throw new BadRequestException('Aliquota fiscal invalida');
      return Math.max(0, parsed);
    };
    const totalValue = money(serviceData.totalValue);
    if (totalValue <= 0) throw new BadRequestException('Valor do servico deve ser maior que zero');

    const issBase = money(serviceData.issBase ?? totalValue);
    const issRate = rate(serviceData.aliquota);
    const issValue = money(issBase * issRate / 100);
    const pisCofinsEnabled = Boolean(serviceData.pisCofinsEnabled);
    const pisCofinsBase = money(serviceData.pisCofinsBase ?? totalValue);
    const pisRate = rate(serviceData.pisRate);
    const cofinsRate = rate(serviceData.cofinsRate);
    const pisValue = pisCofinsEnabled ? money(pisCofinsBase * pisRate / 100) : 0;
    const cofinsValue = pisCofinsEnabled ? money(pisCofinsBase * cofinsRate / 100) : 0;
    const issRetained = String(serviceData.issRetentionType || '1') !== '1';
    const retentionType = String(serviceData.pisCofinsRetentionType || '0');
    const retainedPisValue = pisCofinsEnabled && ['1', '3', '4', '5', '9'].includes(retentionType) ? pisValue : 0;
    const retainedCofinsValue = pisCofinsEnabled && ['1', '3', '4', '6', '7'].includes(retentionType) ? cofinsValue : 0;
    const retainedCsllValue = pisCofinsEnabled && ['3', '7', '8', '9'].includes(retentionType) ? money(serviceData.csllRetainedValue) : 0;
    const retainedTotal = (issRetained ? issValue : 0) + retainedPisValue + retainedCofinsValue + retainedCsllValue;

    if (issBase < 0 || issBase > totalValue) throw new BadRequestException('Base de calculo do ISS invalida');
    if (pisCofinsBase < 0 || pisCofinsBase > totalValue) throw new BadRequestException('Base de calculo do PIS/COFINS invalida');
    if (retainedTotal > totalValue) throw new BadRequestException('Total de retencoes nao pode superar o valor do servico');
    if (issRate > 100 || pisRate > 100 || cofinsRate > 100) throw new BadRequestException('Aliquota fiscal invalida');

    const issRetentionType = String(serviceData.issRetentionType || '1');
    const pisCofinsCst = String(serviceData.pisCofinsCst || '00').padStart(2, '0');
    const pisCofinsRetentionType = String(serviceData.pisCofinsRetentionType || '0');
    const ibsCbsEnabled = Boolean(serviceData.ibsCbsEnabled);
    const ibsStateRate = rate(serviceData.ibsStateRate);
    const ibsMunicipalRate = rate(serviceData.ibsMunicipalRate);
    const cbsRate = rate(serviceData.cbsRate);
    const ibsCbsBase = ibsCbsEnabled ? money(Math.max(0, totalValue - issValue - pisValue - cofinsValue)) : 0;
    if (!['1', '2', '3'].includes(issRetentionType)) throw new BadRequestException('Tipo de retencao do ISS invalido');
    if (pisCofinsEnabled && !/^\d{2}$/.test(pisCofinsCst)) throw new BadRequestException('CST PIS/COFINS invalido');
    if (pisCofinsEnabled && !/^[0-9]$/.test(pisCofinsRetentionType)) throw new BadRequestException('Tipo de retencao PIS/COFINS invalido');
    if ([ibsStateRate, ibsMunicipalRate, cbsRate].some(value => value > 100)) throw new BadRequestException('Aliquota IBS/CBS invalida');
    if (ibsCbsEnabled) {
      if (!/^\d{6}$/.test(String(serviceData.ibsCbsOperationIndicator || ''))) throw new BadRequestException('Indicador da operacao IBS/CBS deve ter 6 digitos');
      if (!/^\d{3}$/.test(String(serviceData.ibsCbsCst || ''))) throw new BadRequestException('CST IBS/CBS deve ter 3 digitos');
      if (!/^\d{6}$/.test(String(serviceData.ibsCbsTaxClassification || ''))) throw new BadRequestException('Classificacao tributaria IBS/CBS deve ter 6 digitos');
    }

    return {
      iss: {
        base: issBase,
        rate: issRate,
        value: issValue,
        retentionType: issRetentionType,
      },
      pisCofins: {
        enabled: pisCofinsEnabled,
        cst: pisCofinsCst,
        base: pisCofinsBase,
        pisRate,
        cofinsRate,
        pisValue,
        cofinsValue,
        retainedPisValue,
        retainedCofinsValue,
        retainedCsllValue,
        retainedSocialContributions: money(retainedPisValue + retainedCofinsValue + retainedCsllValue),
        retentionType: pisCofinsRetentionType,
      },
      ibsCbs: {
        enabled: ibsCbsEnabled,
        purpose: String(serviceData.ibsCbsPurpose || '0'),
        finalConsumer: String(serviceData.ibsCbsFinalConsumer || '0'),
        destinationIndicator: String(serviceData.ibsCbsDestinationIndicator || '0'),
        operationIndicator: String(serviceData.ibsCbsOperationIndicator || ''),
        cst: String(serviceData.ibsCbsCst || ''),
        taxClassification: String(serviceData.ibsCbsTaxClassification || ''),
        base: ibsCbsBase,
        ibsStateRate,
        ibsMunicipalRate,
        cbsRate,
        ibsStateValue: money(ibsCbsBase * ibsStateRate / 100),
        ibsMunicipalValue: money(ibsCbsBase * ibsMunicipalRate / 100),
        cbsValue: money(ibsCbsBase * cbsRate / 100),
      },
      netValue: money(totalValue - retainedTotal),
    };
  }

  @Post('nfse/consult')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  consultNfse(@Body() body: { chave?: string; protocolo?: string; certId: string }) {
    if (body.protocolo) return this.nfseService.consultProtocol(body.protocolo, body.certId);
    if (body.chave) return this.nfseService.consult(body.chave, body.certId);
    throw new Error('Informe chave ou protocolo');
  }

  @Get('nfse/pdf/:invoiceId')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  async downloadNfsePdf(@Param('invoiceId') invoiceId: string, @Res() res: Response) {
    const inv = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!inv) { res.status(404).json({ message: 'Nota nao encontrada' }); return; }
    if (!inv.accessKey) { res.status(400).json({ message: 'Nota sem chave de acesso' }); return; }
    if (!inv.certificateId) { res.status(400).json({ message: 'Nota sem certificado vinculado' }); return; }
    try {
      const pdfBuffer = await this.nfseService.downloadPdf(inv.accessKey, inv.certificateId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="NFSe_${inv.number || 'nota'}_serie${inv.series}.pdf"`);
      res.send(pdfBuffer);
    } catch (e: any) {
      res.status(400).json({ message: e.message || 'Erro ao baixar PDF' });
    }
  }

  @Get('nfse/xml-oficial/:invoiceId')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  async downloadNfseXmlOficial(@Param('invoiceId') invoiceId: string, @Res() res: Response) {
    const inv = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!inv) { res.status(404).json({ message: 'Nota nao encontrada' }); return; }
    if (!inv.accessKey) { res.status(400).json({ message: 'Nota sem chave de acesso' }); return; }
    if (!inv.certificateId) { res.status(400).json({ message: 'Nota sem certificado vinculado' }); return; }
    try {
      const xml = await this.nfseService.downloadXmlFromApi(inv.accessKey, inv.certificateId);
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', `attachment; filename="NFSe_${inv.number || 'nota'}_serie${inv.series}_oficial.xml"`);
      res.send(xml);
    } catch (e: any) {
      res.status(400).json({ message: e.message || 'Erro ao baixar XML' });
    }
  }

  @Post('nfse/cancel')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  async cancelNfse(@Body() body: { invoiceId: string; reason: string; certId: string }, @Request() req: any) {
    return this.nfseService.cancel(body.invoiceId, body.reason, body.certId, req.user?.id);
  }

  @Get('queue')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  getQueue() {
    return this.invoiceRepo.find({
      where: [
        { queueStatus: 'pendente' },
        { queueStatus: 'erro' },
        { queueStatus: 'retry' },
      ],
      select: ['id', 'type', 'number', 'series', 'status', 'queueStatus', 'retryCount', 'nextRetryAt', 'rejectionReason', 'createdAt', 'saleId'],
      order: { createdAt: 'ASC' },
    });
  }

  @Get('rejections')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  getRejections() {
    return this.invoiceRepo.find({
      where: [{ status: 'rejeitada' }, { queueStatus: 'erro' }],
      select: ['id', 'type', 'number', 'series', 'status', 'queueStatus', 'rejectionReason', 'retryCount', 'createdAt', 'saleId'],
      order: { updatedAt: 'DESC' },
    });
  }

  @Post('invoices/:id/retry')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Permissions('fiscal.retry')
  async retryInvoice(@Param('id') id: string, @Request() req: any) {
    const invoice = await this.invoiceRepo.findOne({ where: { id } });
    if (!invoice) throw new Error('Nota não encontrada');
    invoice.queueStatus = 'pendente';
    invoice.retryCount = Number(invoice.retryCount || 0) + 1;
    invoice.nextRetryAt = null;
    const saved = await this.invoiceRepo.save(invoice);
    await this.eventRepo.save(this.eventRepo.create({
      invoiceId: id,
      type: 'retry_requested',
      status: saved.queueStatus,
      message: 'Retry manual solicitado',
      createdBy: req.user.id,
    }));
    return saved;
  }

  @Post('invoices/:id/check-status')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  async checkInvoiceStatus(@Param('id') id: string, @Request() req: any) {
    const invoice = await this.invoiceRepo.findOne({ where: { id } });
    if (!invoice) throw new Error('Nota não encontrada');
    const response = await this.fiscalIntegration.queryStatus(invoice);
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
    await this.eventRepo.save(this.eventRepo.create({
      invoiceId: id,
      type: 'status_checked',
      status: invoice.status,
      message: response.configured === false ? response.message : 'Consulta de status executada no provedor fiscal',
      payload: response,
      createdBy: req.user.id,
    }));
    return { id, status: invoice.status, queueStatus: invoice.queueStatus, response };
  }

  @Post('invoices/:id/correction-letter')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Permissions('fiscal.correction_letter')
  async correctionLetter(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const invoice = await this.invoiceRepo.findOne({ where: { id } });
    if (!invoice) throw new Error('Nota não encontrada');
    const response = await this.fiscalIntegration.sendCorrectionLetter(invoice, body.text);
    if (response.configured === false || response.sent === false) {
      throw new BadRequestException(response.message);
    }
    invoice.correctionLetter = body.text;
    invoice.correctionProtocol = response.protocol || response.protocolo || body.protocol || (response.configured === false ? null : `CC-${Date.now()}`);
    const saved = await this.invoiceRepo.save(invoice);
    await this.eventRepo.save(this.eventRepo.create({
      invoiceId: id,
      type: 'correction_letter',
      status: invoice.status,
      message: response.configured === false ? response.message : body.text,
      payload: response,
      createdBy: req.user.id,
    }));
    return saved;
  }

  @Post('numbering/invalidate')
  @Roles(UserRole.ADMIN)
  @Permissions('fiscal.invalidate_numbering')
  async invalidateNumbering(@Body() body: any, @Request() req: any) {
    const response = await this.fiscalIntegration.invalidateNumbering(body);
    const event = await this.eventRepo.save(this.eventRepo.create({
      type: 'numbering_invalidated',
      status: response.configured === false ? 'pendente_integracao' : 'enviado',
      message: response.configured === false ? response.message : (body.reason || 'Inutilização de numeração enviada'),
      payload: { request: body, response },
      createdBy: req.user.id,
    }));
    return event;
  }

  @Post('jobs/run')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Permissions('fiscal.run_jobs')
  runFiscalJobs() {
    return this.fiscalJobs.run('manual');
  }

  @Post('validate-before-issue')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  async validateBeforeIssue(@Body() body: any) {
    const errors: string[] = [];
    const customer = body.customer || {};
    const items = body.items || [];
    if (!customer.cpfCnpj) errors.push('CNPJ/CPF do cliente obrigatório');
    if (!customer.address && !customer.endereco) errors.push('Endereço do cliente obrigatório');
    for (const item of items) {
      if (!item.cfop) errors.push(`CFOP obrigatório no item ${item.name || item.description || item.productId || ''}`);
      if (!item.ncm) errors.push(`NCM obrigatório no item ${item.name || item.description || item.productId || ''}`);
      if (!item.cst && !item.csosn) errors.push(`CST/CSOSN obrigatório no item ${item.name || item.description || item.productId || ''}`);
    }
    return { valid: errors.length === 0, errors };
  }

  @Get('events')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  getEvents() {
    return this.eventRepo.find({ order: { createdAt: 'DESC' } });
  }
}
