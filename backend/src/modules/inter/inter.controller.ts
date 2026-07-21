import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { InterService } from './inter.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sale } from '../sales/entities/sale.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';

@Controller('inter')
export class InterController {
  private readonly logger = new Logger(InterController.name);

  constructor(
    private readonly interService: InterService,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  /**
   * GET /api/inter/payments
   * Lista todos os pagamentos emitidos.
   */
  @Get('payments')
  @UseGuards(JwtAuthGuard)
  async listPayments() {
    const payments = await this.saleRepo.manager.query(
      `SELECT id, sale_id as "saleId", type, codigo_solicitacao as "codigoSolicitacao", status, value, customer_name as "customerName", customer_doc as "customerDoc", due_date as "dueDate", linha_digitavel as "linhaDigitavel", pix_copia_e_cola as "pixCopiaECola", nosso_numero as "nossoNumero", created_at as "createdAt" FROM payments ORDER BY created_at DESC`
    );
    return payments;
  }

  /**
   * POST /api/inter/generate/:saleId
   * Gera boleto ou PIX para uma venda.
   */
  @Post('generate/:saleId')
  @UseGuards(JwtAuthGuard)
  async generate(
    @Param('saleId') saleId: string,
    @Query('type') type: 'boleto' | 'pix' = 'boleto',
  ) {
    this.logger.log(`Gerando ${type} para venda: ${saleId}`);

    const sale = await this.saleRepo.findOne({
      where: { id: saleId },
      relations: ['customer'],
    });

    if (!sale) {
      throw new HttpException('Venda não encontrada', HttpStatus.NOT_FOUND);
    }

    if (!sale.customer) {
      throw new HttpException('Venda sem cliente associado', HttpStatus.BAD_REQUEST);
    }

    if (!sale.customer.cpfCnpj) {
      throw new HttpException('Cliente sem CPF/CNPJ cadastrado', HttpStatus.BAD_REQUEST);
    }

    const result = await this.interService.generateForSale(sale, type);

    return {
      success: true,
      type,
      data: result,
    };
  }

  /**
   * GET /api/inter/status/:codigoSolicitacao
   * Consulta status de pagamento de um boleto.
   */
  @Get('status/:codigoSolicitacao')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Param('codigoSolicitacao') codigoSolicitacao: string) {
    this.logger.log(`Consultando status: ${codigoSolicitacao}`);

    const boleto = await this.interService.syncBoletoStatus(codigoSolicitacao);

    return {
      success: true,
      data: boleto,
    };
  }

  /**
   * POST /api/inter/reconcile
   * Concilia automaticamente boletos pendentes com o Banco Inter.
   */
  @Post('reconcile')
  @UseGuards(JwtAuthGuard)
  async reconcile() {
    const result = await this.interService.reconcilePendingPayments('manual');
    return {
      success: true,
      data: result,
    };
  }

  @Get('webhook-logs')
  @UseGuards(JwtAuthGuard)
  async webhookLogs() {
    return this.auditRepo.find({
      where: [
        { entity: 'inter', action: 'inter.webhook_received' },
        { entity: 'inter', action: 'inter.webhook_processed' },
        { entity: 'inter', action: 'inter.webhook_error' },
        { entity: 'inter', action: 'inter.webhook_ignored' },
      ],
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  @Post('webhook/reprocess/:auditId')
  @UseGuards(JwtAuthGuard)
  async reprocessWebhook(@Param('auditId') auditId: string) {
    const log = await this.auditRepo.findOne({ where: { id: auditId } });
    const payload = (log as any)?.newData?.payload || (log as any)?.newData;
    if (!payload) throw new HttpException('Payload de webhook não encontrado', HttpStatus.NOT_FOUND);
    return this.interService.handleWebhook(payload);
  }

  @Get('compare/:codigoSolicitacao')
  @UseGuards(JwtAuthGuard)
  async compareLocalInter(@Param('codigoSolicitacao') codigoSolicitacao: string) {
    const local = await this.saleRepo.manager.query(
      `SELECT * FROM payments WHERE codigo_solicitacao = $1 LIMIT 1`,
      [codigoSolicitacao],
    );
    const inter = await this.interService.getBoleto(codigoSolicitacao);
    return { codigoSolicitacao, local: local[0] || null, inter };
  }

  @Post('cancel-batch')
  @UseGuards(JwtAuthGuard)
  async cancelBatch(@Body() body: any) {
    const codes: string[] = body.codigoSolicitacoes || body.codes || [];
    const results = [];
    for (const code of codes) {
      try {
        results.push({ code, success: true, data: await this.interService.cancelBoleto(code, body.reason || 'ACERTOS') });
      } catch (error) {
        results.push({ code, success: false, error: error.message });
      }
    }
    return { total: codes.length, results };
  }

  @Post('expired/:codigoSolicitacao')
  @UseGuards(JwtAuthGuard)
  async handleExpired(@Param('codigoSolicitacao') codigoSolicitacao: string, @Body() body: any) {
    const action = body.action || 'manter';
    if (action === 'cancelar') {
      return this.interService.cancelBoleto(codigoSolicitacao, body.reason || 'ACERTOS');
    }
    if (action === 'segunda_via') {
      const local = await this.saleRepo.manager.query(
        `SELECT sale_id FROM payments WHERE codigo_solicitacao = $1 LIMIT 1`,
        [codigoSolicitacao],
      );
      if (!local[0]?.sale_id) throw new HttpException('Pagamento local não encontrado', HttpStatus.NOT_FOUND);
      const sale = await this.saleRepo.findOne({ where: { id: local[0].sale_id }, relations: ['customer'] });
      return this.interService.generateForSale(sale, 'boleto');
    }
    await this.saleRepo.manager.query(
      `UPDATE payments SET status = 'vencido', updated_at = NOW() WHERE codigo_solicitacao = $1`,
      [codigoSolicitacao],
    );
    return { success: true, action: 'manter', codigoSolicitacao };
  }

  /**
   * POST /api/inter/webhook
   * Recebe notificações de pagamento do Banco Inter.
   * NÃO requer autenticação JWT (chamado pelo Inter).
   */
  @Post('webhook')
  async webhook(@Body() payload: any) {
    this.logger.log('Webhook Inter recebido');

    const result = await this.interService.handleWebhook(payload);

    return result;
  }

  /**
   * GET /api/inter/pdf/:codigoSolicitacao
   * Retorna o PDF do boleto.
   */
  @Get('pdf/:codigoSolicitacao')
  @UseGuards(JwtAuthGuard)
  async getPdf(
    @Param('codigoSolicitacao') codigoSolicitacao: string,
    @Res() res: Response,
  ) {
    this.logger.log(`Obtendo PDF do boleto: ${codigoSolicitacao}`);

    const pdfBuffer = await this.interService.getBoletoPdf(codigoSolicitacao);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="boleto-${codigoSolicitacao}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }
}
