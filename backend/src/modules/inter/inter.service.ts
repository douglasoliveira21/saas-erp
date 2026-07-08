import { Injectable, Logger, HttpException, HttpStatus, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { Sale } from '../sales/entities/sale.entity';
import { FinancialService } from '../financial/financial.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

@Injectable()
export class InterService implements OnModuleInit {
  private readonly logger = new Logger(InterService.name);
  private tokenCache: TokenCache | null = null;
  private agent: https.Agent;
  private readonly baseUrl: string;
  private reconciliationRunning = false;

  constructor(
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    private readonly financialService: FinancialService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
  ) {
    const environment = process.env.INTER_ENVIRONMENT || 'sandbox';
    this.baseUrl = environment === 'production'
      ? 'https://cdpj.partners.bancointer.com.br'
      : 'https://cdpj-sandbox.partners.bancointer.com.br';

    try {
      const certPath = path.resolve(process.env.INTER_CERT_PATH || './certs/inter.crt');
      const keyPath = path.resolve(process.env.INTER_KEY_PATH || './certs/inter.key');

      this.agent = new https.Agent({
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath),
        rejectUnauthorized: true,
      });

      this.logger.log(`Inter API inicializada - Ambiente: ${environment}`);
    } catch (e) {
      this.logger.warn('Certificado Inter nao encontrado: ' + e.message);
      this.agent = new https.Agent();
    }
  }

  private httpRequest(method: string, urlPath: string, body?: any, headers?: Record<string, string>): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + urlPath);
      const options: https.RequestOptions = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        agent: this.agent,
        headers: {
          ...headers,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(data)); }
            catch { resolve(data); }
          } else {
            try { reject({ status: res.statusCode, data: JSON.parse(data) }); }
            catch { reject({ status: res.statusCode, data }); }
          }
        });
      });

      req.on('error', reject);
      if (body) {
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
        req.setHeader('Content-Length', Buffer.byteLength(bodyStr));
        req.write(bodyStr);
      }
      req.end();
    });
  }

  /**
   * Obtém access token via OAuth2 client_credentials com mTLS.
   * Token é cacheado até expirar.
   */
  async getAccessToken(): Promise<string> {
    // Retorna token cacheado se ainda válido (com margem de 60s)
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 60000) {
      return this.tokenCache.accessToken;
    }
    // Limpar cache para forçar novo token
    this.tokenCache = null;

    this.logger.log('Solicitando novo access token ao Banco Inter...');

    try {
      const params = new URLSearchParams();
      params.append('client_id', process.env.INTER_CLIENT_ID);
      params.append('client_secret', process.env.INTER_CLIENT_SECRET);
      params.append('scope', 'boleto-cobranca.write boleto-cobranca.read');
      params.append('grant_type', 'client_credentials');

      const response = await this.httpRequest('POST', '/oauth/v2/token', params.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded',
      });

      const { access_token, expires_in } = response;

      this.tokenCache = {
        accessToken: access_token,
        expiresAt: Date.now() + (expires_in * 1000),
      };

      this.logger.log('Access token obtido com sucesso');
      return access_token;
    } catch (error) {
      this.logger.error('Erro ao obter access token: ' + (error.response?.data?.message || error.message));
      throw new HttpException(
        'Falha ao autenticar com Banco Inter',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Cria boleto + PIX combinado via POST /cobranca/v3/cobrancas
   */
  async createBoleto(data: {
    seuNumero: string;
    valorNominal: number;
    dataVencimento: string;
    numDiasAgenda?: number;
    pagador: {
      cpfCnpj: string;
      tipoPessoa: 'FISICA' | 'JURIDICA';
      nome: string;
      endereco: string;
      cidade: string;
      uf: string;
      cep: string;
    };
    mensagem?: {
      linha1?: string;
      linha2?: string;
      linha3?: string;
      linha4?: string;
      linha5?: string;
    };
  }) {
    const token = await this.getAccessToken();

    this.logger.log(`Criando boleto - seuNumero: ${data.seuNumero}, valor: ${data.valorNominal}`);

    try {
      const response = await this.httpRequest('POST', '/cobranca/v3/cobrancas', data, {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      });

      this.logger.log(`Boleto criado com sucesso - codigoSolicitacao: ${response.codigoSolicitacao}`);
      return response;
    } catch (error) {
      const errorDetail = JSON.stringify(error.data || error.message || error);
      this.logger.error('Erro ao criar boleto - Resposta completa: ' + errorDetail);
      
      // Se já existe boleto com mesmos dados, retornar o código existente
      const detail = error.data?.detail || '';
      const existingMatch = detail.match(/código de solicitação: ([a-f0-9-]+)/);
      if (existingMatch) {
        this.logger.log('Boleto já existe, retornando código existente: ' + existingMatch[1]);
        return { codigoSolicitacao: existingMatch[1], message: 'Boleto já emitido anteriormente' };
      }
      
      const violations = error.data?.violacoes || error.data?.violations || [];
      const violationMsg = violations.map((v: any) => `${v.razao || v.reason || ''}: ${v.propriedade || v.property || ''}`).join('; ');
      throw new HttpException(
        'Falha ao criar boleto: ' + (violationMsg || error.data?.title || error.data?.detail || error.data?.message || errorDetail),
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Consulta boleto via GET /cobranca/v3/cobrancas/{codigoSolicitacao}
   */
  async getBoleto(codigoSolicitacao: string) {
    const token = await this.getAccessToken();

    this.logger.log(`Consultando boleto: ${codigoSolicitacao}`);

    try {
      const response = await this.httpRequest('GET', `/cobranca/v3/cobrancas/${codigoSolicitacao}`, null, {
        Authorization: `Bearer ${token}`,
      });

      return response;
    } catch (error) {
      this.logger.error('Erro ao consultar boleto: ' + (error.data?.message || error));
      throw new HttpException(
        error.data?.message || 'Falha ao consultar boleto',
        error.status || HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Cria cobrança PIX imediata via POST /pix/v2/cob
   */
  /**
   * Cancela uma cobranca emitida no Banco Inter.
   * A API de Cobranca v3 usa o codigoSolicitacao como identificador da baixa.
   */
  async cancelBoleto(codigoSolicitacao: string, motivoCancelamento = 'ACERTOS'): Promise<any> {
    const token = await this.getAccessToken();

    this.logger.log(`Cancelando boleto no Banco Inter: ${codigoSolicitacao}`);

    try {
      const response = await this.httpRequest(
        'PATCH',
        `/cobranca/v3/cobrancas/${codigoSolicitacao}/cancelar`,
        { motivoCancelamento },
        {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      );

      await this.saleRepo.manager.query(
        `UPDATE payments
         SET status = 'cancelado', updated_at = NOW()
         WHERE codigo_solicitacao = $1`,
        [codigoSolicitacao],
      );

      await this.auditInter('inter.boleto_cancelado', null, {
        codigoSolicitacao,
        motivoCancelamento,
        response,
      });

      this.logger.log(`Boleto cancelado no Banco Inter: ${codigoSolicitacao}`);
      return response || { success: true };
    } catch (error) {
      const errorDetail = JSON.stringify(error.data || error.message || error);
      this.logger.error('Erro ao cancelar boleto no Banco Inter: ' + errorDetail);

      try {
        const boleto = await this.getBoleto(codigoSolicitacao);
        const cobranca = boleto?.cobranca || boleto;
        const situacao = cobranca?.situacao || boleto?.situacao || boleto?.status;
        if (this.getLocalPaymentStatus(situacao) === 'cancelado') {
          await this.saleRepo.manager.query(
            `UPDATE payments
             SET status = 'cancelado', updated_at = NOW()
             WHERE codigo_solicitacao = $1`,
            [codigoSolicitacao],
          );
          await this.auditInter('inter.boleto_cancelado_confirmado', null, {
            codigoSolicitacao,
            motivoCancelamento,
            boleto,
          });
          return boleto;
        }
      } catch {}

      throw new HttpException(
        'Falha ao cancelar boleto no Banco Inter: ' + (error.data?.detail || error.data?.message || error.data?.title || errorDetail),
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  onModuleInit() {
    const enabled = process.env.INTER_AUTO_RECONCILE !== 'false';
    if (!enabled) return;
    if (!process.env.INTER_CLIENT_ID || !process.env.INTER_CLIENT_SECRET) {
      this.logger.warn('Conciliacao automatica Inter desativada: credenciais nao configuradas');
      return;
    }

    const configuredInterval = Number(process.env.INTER_RECONCILE_INTERVAL_MINUTES || 30);
    const intervalMinutes = Number.isFinite(configuredInterval) ? configuredInterval : 30;
    const intervalMs = Math.max(intervalMinutes, 5) * 60 * 1000;

    setTimeout(() => this.runScheduledReconciliation('startup'), 15000);
    setInterval(() => this.runScheduledReconciliation('interval'), intervalMs);
  }

  private async auditInter(action: string, entityId: string | null, data: any): Promise<void> {
    try {
      await this.auditService.create({
        action,
        entity: 'inter',
        entityId,
        newData: data,
      });
    } catch (error) {
      this.logger.warn('Falha ao registrar auditoria Inter: ' + error.message);
    }
  }

  private async runScheduledReconciliation(source: string): Promise<void> {
    try {
      await this.reconcilePendingPayments(source);
    } catch (error) {
      this.logger.error('Erro na conciliacao automatica Inter: ' + error.message);
      await this.auditInter('inter.reconcile_error', null, {
        source,
        error: error.message,
      });
    }
  }

  async cancelPaymentsForSale(saleId: string, motivoCancelamento = 'ACERTOS'): Promise<void> {
    const payments = await this.saleRepo.manager.query(
      `SELECT codigo_solicitacao, type, status
       FROM payments
       WHERE sale_id = $1
         AND status NOT IN ('cancelado', 'pago')
         AND COALESCE(codigo_solicitacao, '') <> ''`,
      [saleId],
    );

    for (const payment of payments) {
      if (payment.type === 'boleto') {
        await this.cancelBoleto(payment.codigo_solicitacao, motivoCancelamento);
      }
    }
  }

  async createPixImmediate(data: {
    calendario?: { expiracao: number };
    valor: { original: string };
    chave: string;
    solicitacaoPagador?: string;
    infoAdicionais?: Array<{ nome: string; valor: string }>;
  }) {
    // PIX precisa de token com escopo específico
    let token: string;
    try {
      const params = new URLSearchParams();
      params.append('client_id', process.env.INTER_CLIENT_ID);
      params.append('client_secret', process.env.INTER_CLIENT_SECRET);
      params.append('scope', 'pix.write pix.read');
      params.append('grant_type', 'client_credentials');
      const tokenRes = await this.httpRequest('POST', '/oauth/v2/token', params.toString(), {
        'Content-Type': 'application/x-www-form-urlencoded',
      });
      token = tokenRes.access_token;
    } catch (error) {
      this.logger.error('PIX não habilitado para esta conta. Habilite o escopo PIX no painel do Banco Inter.');
      throw new HttpException(
        'PIX não habilitado. Habilite o escopo "pix.write" e "pix.read" no painel do Banco Inter na configuração da sua aplicação API.',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(`Criando PIX imediato - valor: ${data.valor.original}`);

    try {
      const response = await this.httpRequest('POST', '/pix/v2/cob', data, {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      });

      this.logger.log(`PIX criado com sucesso - txid: ${response.txid}`);
      return response;
    } catch (error) {
      this.logger.error('Erro ao criar PIX: ' + JSON.stringify(error.data || error));
      throw new HttpException(
        error.data?.message || 'Falha ao criar cobrança PIX',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Consulta QR Code PIX via GET /pix/v2/cob/{txid}
   */
  async getPixQrCode(txid: string) {
    const token = await this.getAccessToken();

    this.logger.log(`Consultando PIX QR Code: ${txid}`);

    try {
      const response = await this.httpRequest('GET', `/pix/v2/cob/${txid}`, null, {
        Authorization: `Bearer ${token}`,
      });

      return response;
    } catch (error) {
      this.logger.error('Erro ao consultar PIX: ' + (error.data?.message || error));
      throw new HttpException(
        error.data?.message || 'Falha ao consultar PIX',
        error.status || HttpStatus.NOT_FOUND,
      );
    }
  }

  private getLocalPaymentStatus(situacao?: string): string {
    const status = (situacao || '').toUpperCase();
    if (['RECEBIDO', 'CONFIRMADO', 'PAGO', 'REALIZADO', 'CONCLUIDA'].includes(status)) {
      return 'pago';
    }
    if (['VENCIDO', 'EXPIRADO'].includes(status)) {
      return 'vencido';
    }
    if (['CANCELADO', 'CANCELADA', 'REMOVIDA_PELO_USUARIO_RECEBEDOR', 'REMOVIDA_PELO_PSP'].includes(status)) {
      return 'cancelado';
    }
    return 'a_receber';
  }

  private async markSaleAsPaid(saleId: string, paymentMethod = 'boleto'): Promise<void> {
    await this.saleRepo.manager.query(
      `UPDATE sales SET status = 'pago', updated_at = NOW() WHERE id = $1 AND status != 'pago'`,
      [saleId],
    );

    await this.saleRepo.manager.query(
      `UPDATE accounts_receivable
       SET paid_value = total_value, pending_value = 0, status = 'pago', paid_at = COALESCE(paid_at, NOW()), updated_at = NOW()
       WHERE sale_id = $1 AND status != 'pago'`,
      [saleId],
    );

    await this.saleRepo.manager.query(
      `UPDATE installments
       SET paid_value = value, status = 'pago', paid_at = COALESCE(paid_at, NOW()), payment_method = $2, updated_at = NOW()
       WHERE sale_id = $1 AND status != 'pago'`,
      [saleId, paymentMethod],
    );

    await this.saleRepo.manager.query(
      `UPDATE financial_movements
       SET is_forecast = false, date = CURRENT_DATE, payment_method = $2
       WHERE sale_id = $1 AND type = 'receita' AND category = 'venda' AND is_forecast = true`,
      [saleId, paymentMethod],
    );
  }

  private async markBoletoAsIssued(saleId: string): Promise<void> {
    await this.saleRepo.manager.query(
      `UPDATE sales
       SET status = 'boleto_emitido', updated_at = NOW()
       WHERE id = $1 AND status IN ('pendente', 'nf_emitida')`,
      [saleId],
    );

    await this.saleRepo.manager.query(
      `UPDATE financial_tasks
       SET status = 'concluido',
           completed_at = COALESCE(completed_at, NOW()),
           observations = COALESCE(observations, 'Boleto emitido via Banco Inter')
       WHERE sale_id = $1 AND type = 'emissao_boleto' AND status = 'pendente'`,
      [saleId],
    );
  }

  private async applyPaymentStatus(codigoSolicitacao: string, interData: any): Promise<{
    saleId?: string;
    type?: string;
    oldStatus?: string;
    newStatus: string;
    changed: boolean;
    situacao?: string;
  }> {
    const cobranca = interData?.cobranca || interData;
    const boleto = interData?.boleto || {};
    const pix = interData?.pix || {};
    const situacao = cobranca?.situacao || interData?.situacao || interData?.status;
    const localStatus = this.getLocalPaymentStatus(situacao);

    const previous = await this.saleRepo.manager.query(
      `SELECT sale_id, type, status
       FROM payments
       WHERE codigo_solicitacao = $1
       LIMIT 1`,
      [codigoSolicitacao],
    );

    const updated = await this.saleRepo.manager.query(
      `UPDATE payments
       SET status = $1,
           linha_digitavel = COALESCE($2, linha_digitavel),
           pix_copia_e_cola = COALESCE($3, pix_copia_e_cola),
           nosso_numero = COALESCE($4, nosso_numero),
           updated_at = NOW()
       WHERE codigo_solicitacao = $5
       RETURNING sale_id, type`,
      [
        localStatus,
        boleto?.linhaDigitavel || interData?.linhaDigitavel || null,
        pix?.pixCopiaECola || interData?.pixCopiaECola || null,
        boleto?.nossoNumero || interData?.nossoNumero || null,
        codigoSolicitacao,
      ],
    );

    if (updated[0]?.sale_id && updated[0].type === 'boleto' && localStatus !== 'cancelado') {
      await this.markBoletoAsIssued(updated[0].sale_id);
    }

    if (localStatus === 'pago' && updated[0]?.sale_id) {
      await this.markSaleAsPaid(updated[0].sale_id, updated[0].type || 'boleto');
    }

    return {
      saleId: updated[0]?.sale_id || previous[0]?.sale_id,
      type: updated[0]?.type || previous[0]?.type,
      oldStatus: previous[0]?.status,
      newStatus: localStatus,
      changed: Boolean(previous[0]) && previous[0].status !== localStatus,
      situacao,
    };
  }

  async syncBoletoStatus(codigoSolicitacao: string): Promise<any> {
    const boleto = await this.getBoleto(codigoSolicitacao);
    const statusUpdate = await this.applyPaymentStatus(codigoSolicitacao, boleto);
    await this.auditInter('inter.status_sync', statusUpdate.saleId || null, {
      codigoSolicitacao,
      statusUpdate,
      source: 'manual',
    });
    return boleto;
  }

  async reconcilePendingPayments(source = 'manual'): Promise<{ checked: number; updated: number; failed: number }> {
    if (this.reconciliationRunning) {
      return { checked: 0, updated: 0, failed: 0 };
    }

    this.reconciliationRunning = true;
    let checked = 0;
    let updated = 0;
    let failed = 0;

    try {
      const limit = Math.max(Number(process.env.INTER_RECONCILE_BATCH_SIZE || 50), 1);
      const payments = await this.saleRepo.manager.query(
        `SELECT id, sale_id, codigo_solicitacao, status
         FROM payments
         WHERE type = 'boleto'
           AND status IN ('a_receber', 'vencido')
           AND COALESCE(codigo_solicitacao, '') <> ''
         ORDER BY updated_at ASC NULLS FIRST, created_at ASC
         LIMIT $1`,
        [limit],
      );

      await this.auditInter('inter.reconcile_started', null, {
        source,
        total: payments.length,
      });

      for (const payment of payments) {
        checked++;
        try {
          const boleto = await this.getBoleto(payment.codigo_solicitacao);
          const statusUpdate = await this.applyPaymentStatus(payment.codigo_solicitacao, boleto);
          if (statusUpdate.changed) updated++;

          await this.auditInter('inter.reconcile_payment', statusUpdate.saleId || payment.sale_id || null, {
            source,
            paymentId: payment.id,
            codigoSolicitacao: payment.codigo_solicitacao,
            statusUpdate,
          });
        } catch (error) {
          failed++;
          await this.auditInter('inter.reconcile_payment_error', payment.sale_id || null, {
            source,
            paymentId: payment.id,
            codigoSolicitacao: payment.codigo_solicitacao,
            error: error.message,
          });
        }
      }

      const result = { checked, updated, failed };
      await this.auditInter('inter.reconcile_finished', null, {
        source,
        result,
      });
      return result;
    } finally {
      this.reconciliationRunning = false;
    }
  }

  /**
   * Processa webhook de pagamento do Banco Inter.
   * Localiza a venda pelo seuNumero, atualiza status e registra no financeiro.
   */
  async handleWebhook(payload: any): Promise<{ success: boolean; message: string }> {
    this.logger.log('Webhook recebido do Banco Inter: ' + JSON.stringify(payload));
    await this.auditInter('inter.webhook_received', null, { payload });

    try {
      const events = Array.isArray(payload) ? payload : [payload];
      let processed = 0;

      for (const event of events) {
        const codigoSolicitacao = event.codigoSolicitacao || event.cobranca?.codigoSolicitacao;
        if (codigoSolicitacao) {
          const statusUpdate = await this.applyPaymentStatus(codigoSolicitacao, event);
          await this.auditInter('inter.webhook_processed', statusUpdate.saleId || null, {
            codigoSolicitacao,
            statusUpdate,
            event,
          });
          processed++;
          continue;
        }

        const seuNumero = event.cobranca?.seuNumero || event.seuNumero || event.txid;
        const situacao = event.cobranca?.situacao || event.situacao || event.status;

        if (!seuNumero) {
          this.logger.warn('Webhook sem identificador de venda (seuNumero/txid/codigoSolicitacao)');
          await this.auditInter('inter.webhook_ignored', null, {
            reason: 'missing_identifier',
            event,
          });
          continue;
        }

        if (this.getLocalPaymentStatus(situacao) !== 'pago') {
          await this.auditInter('inter.webhook_ignored', null, {
            reason: 'not_paid',
            seuNumero,
            situacao,
            event,
          });
          this.logger.log(`Webhook com situação "${situacao}" - ignorando (não é pagamento confirmado)`);
          processed++;
          continue;
        }

        let foundSale = await this.saleRepo.findOne({
          where: { id: seuNumero },
          relations: ['customer'],
        });

        if (!foundSale) {
          const sales = await this.saleRepo
            .createQueryBuilder('sale')
            .leftJoinAndSelect('sale.customer', 'customer')
            .where('sale.id LIKE :id', { id: `${seuNumero}%` })
            .getMany();

          if (sales.length === 1) {
            foundSale = sales[0];
          }
        }

        if (!foundSale) {
          this.logger.warn(`Venda não encontrada para seuNumero: ${seuNumero}`);
          await this.auditInter('inter.webhook_ignored', null, {
            reason: 'sale_not_found',
            seuNumero,
            situacao,
            event,
          });
          continue;
        }

        await this.markSaleAsPaid(foundSale.id, 'boleto');
        await this.auditInter('inter.webhook_sale_paid', foundSale.id, {
          seuNumero,
          situacao,
          event,
        });
        this.logger.log(`Venda ${foundSale.id} marcada como paga via webhook`);

        if (foundSale.customer?.email) {
          await this.sendPaymentConfirmationEmail(foundSale);
        }

        processed++;
      }

      return { success: true, message: `${processed} evento(s) processado(s)` };
    } catch (error) {
      this.logger.error('Erro ao processar webhook: ' + error.message);
      await this.auditInter('inter.webhook_error', null, {
        payload,
        error: error.message,
      });
      return { success: false, message: 'Erro interno ao processar webhook' };
    }
  }

  /**
   * Gera boleto ou PIX para uma venda existente.
   */
  async generateForSale(
    sale: Sale,
    type: 'boleto' | 'pix' = 'boleto',
  ): Promise<any> {
    const customer = sale.customer;

    if (!customer) {
      throw new HttpException('Venda sem cliente associado', HttpStatus.BAD_REQUEST);
    }

    if (type === 'boleto') {
      // Usar data de vencimento da venda ou calcular +7 dias
      let dataVencimento: string;
      if ((sale as any).dueDate) {
        dataVencimento = (sale as any).dueDate;
      } else {
        const vencimento = new Date();
        const dueDay = (sale as any).dueDay;
        if (dueDay) {
          vencimento.setDate(dueDay);
          if (vencimento <= new Date()) vencimento.setMonth(vencimento.getMonth() + 1);
        } else {
          vencimento.setDate(vencimento.getDate() + 7);
        }
        dataVencimento = vencimento.getFullYear() + '-' + String(vencimento.getMonth()+1).padStart(2,'0') + '-' + String(vencimento.getDate()).padStart(2,'0');
      }

      const tipoPessoa = (customer.cpfCnpj?.length || 0) > 11 ? 'JURIDICA' : 'FISICA';

      const multaTaxa = parseFloat(Number((sale as any).multaPercentage ?? 2).toFixed(2));
      const moraTaxa = parseFloat(Number((sale as any).moraPercentage ?? 0.03).toFixed(2));

      const boletoData: any = {
        seuNumero: sale.id.substring(0, 15),
        valorNominal: Number(sale.totalAmount),
        dataVencimento,
        numDiasAgenda: 30,
        pagador: {
          cpfCnpj: (customer.cpfCnpj || '').replace(/\D/g, ''),
          tipoPessoa: tipoPessoa as 'FISICA' | 'JURIDICA',
          nome: customer.name.substring(0, 50),
          endereco: (customer.address || 'Rua nao informada').substring(0, 90),
          cidade: (customer.city || 'Contagem').substring(0, 60),
          uf: customer.uf || 'MG',
          cep: (customer.cep || '32000000').replace(/\D/g, '').padEnd(8, '0').substring(0, 8),
        },
        mensagem: {
          linha1: 'Pagamento referente a venda de servicos',
          linha2: `Venda #${sale.id.substring(0, 8)}`,
          linha3: `Multa: ${multaTaxa}% apos vencimento`,
          linha4: `Juros: ${moraTaxa}% a.m. apos vencimento`,
        },
      };

      // Multa e Mora - Inter API Cobrança v3
      if (multaTaxa > 0) {
        boletoData.multa = {
          codigo: 'PERCENTUAL',
          taxa: multaTaxa,
        };
      }
      if (moraTaxa > 0) {
        boletoData.mora = {
          codigo: 'TAXAMENSAL',
          taxa: moraTaxa,
        };
      }

      this.logger.log('Payload boleto: ' + JSON.stringify(boletoData));

      const result = await this.createBoleto(boletoData);

      // Salvar pagamento no banco
      await this.saleRepo.manager.query(
        `INSERT INTO payments (sale_id, customer_id, type, codigo_solicitacao, status, value, customer_name, customer_doc, due_date, linha_digitavel, nosso_numero)
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
         WHERE NOT EXISTS (SELECT 1 FROM payments WHERE codigo_solicitacao = $4)`,
        [sale.id, customer.id || null, 'boleto', result.codigoSolicitacao || '', 'a_receber', Number(sale.totalAmount), customer.name, (customer.cpfCnpj || '').replace(/\D/g, ''), dataVencimento, result.linhaDigitavel || '', result.nossoNumero || '']
      );

      await this.markBoletoAsIssued(sale.id);

      // Enviar email com PDF do boleto ao cliente
      if (false && customer.email) {
        try {
          // Buscar PDF do boleto
          const pdfBuffer = await this.getBoletoPdf(result.codigoSolicitacao);
          
          // Enviar email com PDF anexo
          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #f97316; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0;">Boleto de Pagamento</h1>
              </div>
              <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="color: #4b5563;">Olá ${customer.name},</p>
                <p style="color: #4b5563;">Segue em anexo o boleto para pagamento:</p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                  <tr><td style="padding: 8px; color: #6b7280;">Valor:</td><td style="padding: 8px; font-weight: bold; color: #059669;">R$ ${Number(sale.totalAmount).toFixed(2)}</td></tr>
                  <tr><td style="padding: 8px; color: #6b7280;">Vencimento:</td><td style="padding: 8px; font-weight: bold;">${dataVencimento.split('-').reverse().join('/')}</td></tr>
                  ${result.linhaDigitavel ? `<tr><td style="padding: 8px; color: #6b7280;">Linha Digitável:</td><td style="padding: 8px; font-size: 11px; word-break: break-all;">${result.linhaDigitavel}</td></tr>` : ''}
                </table>
                <p style="color: #6b7280; font-size: 14px;">Efetue o pagamento até a data de vencimento.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="color: #9ca3af; font-size: 12px; text-align: center;">VGON Soluções em Informática</p>
              </div>
            </div>
          `;
          await this.mailService.sendMailWithAttachment(customer.email, 'Boleto de Pagamento - VGON', html, [{
            filename: `boleto-${result.codigoSolicitacao.substring(0, 8)}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          }]);
          this.logger.log('Email com PDF do boleto enviado para: ' + customer.email);
        } catch (e) {
          this.logger.error('Erro ao enviar email do boleto: ' + e.message);
          // Tentar enviar sem anexo como fallback
          try {
            await this.sendBoletoEmail(customer.email, customer.name, result, sale);
          } catch {}
        }
      } else {
        this.logger.warn('Cliente sem email cadastrado');
      }

      return result;
    } else {
      // PIX imediato
      const pixData = {
        calendario: { expiracao: 3600 }, // 1 hora
        valor: { original: Number(sale.totalAmount).toFixed(2) },
        chave: process.env.INTER_ACCOUNT || '',
        solicitacaoPagador: `Venda #${sale.id.substring(0, 8)} - ${customer.name}`,
        infoAdicionais: [
          { nome: 'Venda', valor: sale.id.substring(0, 8) },
          { nome: 'Cliente', valor: customer.name },
        ],
      };

      const result = await this.createPixImmediate(pixData);

      // Enviar email com QR Code PIX
      if (customer.email) {
        try {
          await this.sendPixEmail(customer.email, customer.name, result, sale);
          this.logger.log('Email do PIX enviado para: ' + customer.email);
        } catch (e) {
          this.logger.error('Erro ao enviar email do PIX: ' + e.message);
        }
      }

      return result;
    }
  }

  /**
   * Obtém PDF do boleto
   */
  async getBoletoPdf(codigoSolicitacao: string): Promise<Buffer> {
    const token = await this.getAccessToken();

    this.logger.log(`Obtendo PDF do boleto: ${codigoSolicitacao}`);

    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + `/cobranca/v3/cobrancas/${codigoSolicitacao}/pdf`);
      const options: https.RequestOptions = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'GET',
        agent: this.agent,
        headers: { Authorization: `Bearer ${token}` },
      };

      const req = https.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // Verificar se é JSON com base64 ou binário direto
            const contentType = res.headers['content-type'] || '';
            if (contentType.includes('application/json')) {
              try {
                const json = JSON.parse(body.toString());
                if (json.pdf) {
                  resolve(Buffer.from(json.pdf, 'base64'));
                } else {
                  resolve(body);
                }
              } catch {
                resolve(body);
              }
            } else {
              resolve(body);
            }
          } else {
            this.logger.error('Erro PDF - Status: ' + res.statusCode + ' Body: ' + body.toString().substring(0, 200));
            reject(new HttpException('Falha ao obter PDF do boleto', res.statusCode || HttpStatus.NOT_FOUND));
          }
        });
      });

      req.on('error', (e) => {
        this.logger.error('Erro conexão PDF: ' + e.message);
        reject(new HttpException('Erro de conexão ao obter PDF', HttpStatus.SERVICE_UNAVAILABLE));
      });
      req.end();
    });
  }

  // ==================== Private Helpers ====================

  private async sendBoletoEmail(
    email: string,
    customerName: string,
    boletoData: any,
    sale: Sale,
  ): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f97316; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">Boleto Gerado</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="color: #4b5563;">Olá ${customerName},</p>
          <p style="color: #4b5563;">Seu boleto foi gerado com sucesso. Seguem os dados:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px; color: #6b7280;">Valor:</td><td style="padding: 8px; font-weight: bold; color: #059669;">R$ ${Number(sale.totalAmount).toFixed(2)}</td></tr>
            <tr><td style="padding: 8px; color: #6b7280;">Código:</td><td style="padding: 8px;">${boletoData.codigoSolicitacao || ''}</td></tr>
            <tr><td style="padding: 8px; color: #6b7280;">Nosso Número:</td><td style="padding: 8px;">${boletoData.nossoNumero || ''}</td></tr>
            ${boletoData.linhaDigitavel ? `<tr><td style="padding: 8px; color: #6b7280;">Linha Digitável:</td><td style="padding: 8px; font-size: 12px; word-break: break-all;">${boletoData.linhaDigitavel}</td></tr>` : ''}
          </table>
          <p style="color: #6b7280; font-size: 14px;">Efetue o pagamento até a data de vencimento para evitar juros e multa.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">VGON Soluções em Informática</p>
        </div>
      </div>
    `;

    await this.mailService.sendMail(email, 'Boleto Gerado - VGON', html);
  }

  private async sendPixEmail(
    email: string,
    customerName: string,
    pixData: any,
    sale: Sale,
  ): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #10b981; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">Cobrança PIX Gerada</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="color: #4b5563;">Olá ${customerName},</p>
          <p style="color: #4b5563;">Sua cobrança PIX foi gerada com sucesso:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px; color: #6b7280;">Valor:</td><td style="padding: 8px; font-weight: bold; color: #059669;">R$ ${Number(sale.totalAmount).toFixed(2)}</td></tr>
            <tr><td style="padding: 8px; color: #6b7280;">TXID:</td><td style="padding: 8px;">${pixData.txid || ''}</td></tr>
            ${pixData.pixCopiaECola ? `<tr><td style="padding: 8px; color: #6b7280;">PIX Copia e Cola:</td><td style="padding: 8px; font-size: 11px; word-break: break-all;">${pixData.pixCopiaECola}</td></tr>` : ''}
          </table>
          <p style="color: #ef4444; font-size: 14px; font-weight: bold;">⏰ Este PIX expira em 1 hora.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">VGON Soluções em Informática</p>
        </div>
      </div>
    `;

    await this.mailService.sendMail(email, 'Cobrança PIX - VGON', html);
  }

  private async sendPaymentConfirmationEmail(sale: Sale): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #059669; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">✅ Pagamento Confirmado</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="color: #4b5563;">Olá ${sale.customer.name},</p>
          <p style="color: #4b5563;">Confirmamos o recebimento do seu pagamento:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px; color: #6b7280;">Valor:</td><td style="padding: 8px; font-weight: bold; color: #059669;">R$ ${Number(sale.totalAmount).toFixed(2)}</td></tr>
            <tr><td style="padding: 8px; color: #6b7280;">Venda:</td><td style="padding: 8px;">#${sale.id.substring(0, 8)}</td></tr>
            <tr><td style="padding: 8px; color: #6b7280;">Data:</td><td style="padding: 8px;">${new Date().toLocaleDateString('pt-BR')}</td></tr>
          </table>
          <p style="color: #4b5563;">Obrigado pela preferência!</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">VGON Soluções em Informática</p>
        </div>
      </div>
    `;

    await this.mailService.sendMail(
      sale.customer.email,
      'Pagamento Confirmado - VGON',
      html,
    );
  }
}
