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

@Controller('inter')
export class InterController {
  private readonly logger = new Logger(InterController.name);

  constructor(
    private readonly interService: InterService,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
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
