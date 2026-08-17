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
  Headers,
  Req,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { InterService } from './inter.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions, Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { RolesGuard } from '../auth/guards/roles.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sale } from '../sales/entities/sale.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';

@Controller('inter')
export class InterController {
  private readonly logger = new Logger(InterController.name);
  private readonly webhookSecret = process.env.INTER_WEBHOOK_SECRET || '';
  private readonly webhookRate = new Map<string, { count: number; resetAt: number }>();

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
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async listPayments(@Query('page') page = '1', @Query('limit') limit = '50') {
    const safePage = Math.max(Number(page) || 1, 1); const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const payments = await this.saleRepo.manager.query(
      `SELECT p.id, p.sale_id as "saleId", p.customer_id as "customerId", p.type, p.codigo_solicitacao as "codigoSolicitacao", p.status, p.value, p.customer_name as "customerName", p.customer_doc as "customerDoc", p.due_date as "dueDate", p.linha_digitavel as "linhaDigitavel", p.pix_copia_e_cola as "pixCopiaECola", p.nosso_numero as "nossoNumero", p.created_at as "createdAt",
       CASE WHEN p.sale_id IS NOT NULL THEN 'venda' ELSE COALESCE((SELECT 'contrato' FROM contract_billings cb WHERE cb.boleto_code = p.codigo_solicitacao LIMIT 1), 'outro') END as "origem",
       CASE WHEN p.sale_id IS NOT NULL THEN NULL ELSE (SELECT c.title FROM contract_billings cb JOIN contracts c ON c.id = cb.contract_id WHERE cb.boleto_code = p.codigo_solicitacao LIMIT 1) END as "contractTitle"
       FROM payments p ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
      [safeLimit, (safePage - 1) * safeLimit],
    );
    const count = await this.saleRepo.manager.query(`SELECT COUNT(*)::int AS total FROM payments`);
    return { data: payments, total: Number(count[0]?.total || 0), page: safePage, limit: safeLimit };
  }
  /**
   * POST /api/inter/generate/:saleId
   * Gera boleto ou PIX para uma venda.
   */
  @Post('generate/:saleId')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async reconcile() {
    const result = await this.interService.reconcilePendingPayments('manual');
    return {
      success: true,
      data: result,
    };
  }

  @Get('webhook-logs')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Permissions('inter.reprocess_webhook')
  async reprocessWebhook(@Param('auditId') auditId: string) {
    const log = await this.auditRepo.findOne({ where: { id: auditId } });
    const payload = (log as any)?.newData?.payload || (log as any)?.newData;
    if (!payload) throw new HttpException('Payload de webhook não encontrado', HttpStatus.NOT_FOUND);
    return this.interService.handleWebhook(payload);
  }

  @Get('compare/:codigoSolicitacao')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async compareLocalInter(@Param('codigoSolicitacao') codigoSolicitacao: string) {
    const local = await this.saleRepo.manager.query(
      `SELECT * FROM payments WHERE codigo_solicitacao = $1 LIMIT 1`,
      [codigoSolicitacao],
    );
    const inter = await this.interService.getBoleto(codigoSolicitacao);
    return { codigoSolicitacao, local: local[0] || null, inter };
  }

  @Post('cancel-batch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Permissions('inter.cancel_batch')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @Permissions('inter.handle_expired')
  async handleExpired(@Param('codigoSolicitacao') codigoSolicitacao: string, @Body() body: any) {
    const action = body.action || 'manter';
    if (action === 'cancelar') {
      return this.interService.cancelBoleto(codigoSolicitacao, body.reason || 'ACERTOS');
    }
    if (action === 'segunda_via') {
      const local = await this.saleRepo.manager.query(`SELECT sale_id FROM payments WHERE codigo_solicitacao=$1 LIMIT 1`, [codigoSolicitacao]);
      if (!local[0]?.sale_id) throw new HttpException('Pagamento local não encontrado', HttpStatus.NOT_FOUND);
      const newDueDate = String(body.newDueDate || ''); const now = new Date(); const today = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(newDueDate) || newDueDate < today) throw new HttpException('Informe um novo vencimento válido', HttpStatus.BAD_REQUEST);
      await this.interService.cancelBoleto(codigoSolicitacao, body.reason || 'ACERTOS');
      await this.saleRepo.update(local[0].sale_id, { dueDate: newDueDate, billingStatus: 'nao_emitido' });
      const sale = await this.saleRepo.findOne({ where: { id: local[0].sale_id }, relations: ['customer'] });
      return this.interService.generateForSale(sale, 'boleto');
    }
    await this.saleRepo.manager.transaction(async (manager) => {
      const rows = await manager.query(`UPDATE payments SET status='vencido', updated_at=NOW() WHERE codigo_solicitacao=$1 RETURNING sale_id`, [codigoSolicitacao]);
      if (rows[0]?.sale_id) await manager.query(`UPDATE sales SET billing_status='vencido', updated_at=NOW() WHERE id=$1`, [rows[0].sale_id]);
    });
    return { success: true, action: 'manter', codigoSolicitacao };
  }

  /**
   * POST /api/inter/webhook
   * Recebe notificações de pagamento do Banco Inter.
   * NÃO requer autenticação JWT (chamado pelo Inter).
   */
  @Post('webhook')
  async webhook(@Body() payload: any, @Headers('x-inter-webhook-secret') headerSecret: string | undefined, @Query('token') querySecret: string | undefined, @Req() req: Request) {
    if (!this.webhookSecret && process.env.NODE_ENV === 'production') throw new HttpException('Webhook Inter nao configurado', HttpStatus.SERVICE_UNAVAILABLE);
    if (this.webhookSecret) {
      const received = headerSecret || querySecret || '';
      const expectedBuffer = Buffer.from(this.webhookSecret);
      const receivedBuffer = Buffer.from(received);
      if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) throw new HttpException('Origem do webhook nao autorizada', HttpStatus.UNAUTHORIZED);
    }
    const sourceIp = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const current = this.webhookRate.get(sourceIp);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + 60_000 } : current;
    bucket.count++;
    this.webhookRate.set(sourceIp, bucket);
    const limit = Math.max(1, Number(process.env.INTER_WEBHOOK_RATE_LIMIT || 60));
    if (bucket.count > limit) throw new HttpException('Limite de webhooks excedido', HttpStatus.TOO_MANY_REQUESTS);
    const result = await this.interService.handleWebhook(payload, sourceIp);
    if (!result.success) throw new HttpException(result.message, HttpStatus.BAD_GATEWAY);
    return result;
  }
  /**
   * GET /api/inter/pdf/:codigoSolicitacao
   * Retorna o PDF do boleto.
   */
  @Get('pdf/:codigoSolicitacao')
  @Roles(UserRole.ADMIN, UserRole.FINANCEIRO)
  @UseGuards(JwtAuthGuard, RolesGuard)
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
