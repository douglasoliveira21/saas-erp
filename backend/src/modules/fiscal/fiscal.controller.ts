import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CertificateService } from './services/certificate.service';
import { NfeService } from './services/nfe.service';
import { NfseService } from './services/nfse.service';
import { Invoice } from './entities/invoice.entity';
import { FiscalConfig } from './entities/fiscal-config.entity';
import { FinancialTask } from '../financial-tasks/entities/financial-task.entity';
import { MailService } from '../mail/mail.service';

@Controller('fiscal')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FiscalController {
  constructor(
    private certificateService: CertificateService,
    private nfeService: NfeService,
    private nfseService: NfseService,
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    @InjectRepository(FiscalConfig) private configRepo: Repository<FiscalConfig>,
    @InjectRepository(FinancialTask) private taskRepo: Repository<FinancialTask>,
    private mailService: MailService,
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
  async updateConfig(@Body() body: any) {
    const config = await this.configRepo.findOne({ where: {} });
    if (!config) return this.configRepo.save(this.configRepo.create(body));
    Object.assign(config, body);
    return this.configRepo.save(config);
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
  async emitNfe(@Body() body: { saleId: string; certId: string; saleData?: any }) {
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
  cancelNfe(@Body() body: { invoiceId: string; reason: string; certId: string }) {
    return this.nfeService.cancel(body.invoiceId, body.reason, body.certId);
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
    const invoice = this.invoiceRepo.create({
      saleId: body.saleId,
      certificateId: body.certId,
      type: 'nfse',
      status: 'pendente',
      recipientCnpj: body.serviceData?.recipientCnpj,
      recipientName: body.serviceData?.recipientName,
      totalValue: body.serviceData?.totalValue,
    });
    const saved = await this.invoiceRepo.save(invoice);
    const result = await this.nfseService.emit(saved.id, body.serviceData, body.certId);
    if (result.status === 'autorizada' && body.saleId) {
      await this.completeNfTask(body.saleId);
      // Enviar NFS-e por email ao cliente
      try {
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
  cancelNfse(@Body() body: { invoiceId: string; reason: string; certId: string }) {
    return this.nfseService.cancel(body.invoiceId, body.reason, body.certId);
  }
}
