import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { InterService } from '../inter/inter.service';
import { NfseService } from '../fiscal/services/nfse.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class ContractBillingService implements OnModuleInit {
  private readonly logger = new Logger(ContractBillingService.name);
  private running = false;

  constructor(
    @InjectRepository(Contract)
    private contractRepo: Repository<Contract>,
    private dataSource: DataSource,
    private interService: InterService,
    private nfseService: NfseService,
    private mailService: MailService,
  ) {}

  onModuleInit() {
    // Run billing check daily
    const enabled = process.env.CONTRACT_AUTO_BILLING !== 'false';
    if (!enabled) return;

    // Check on startup after 30s delay
    setTimeout(() => this.runBillingCheck(), 30000);

    // Check every 6 hours
    setInterval(() => this.runBillingCheck(), 6 * 60 * 60 * 1000);
  }

  /**
   * Main billing check: finds contracts that need billing 7 days before due date
   */
  async runBillingCheck(): Promise<{ processed: number; billed: number; errors: number; skipped?: boolean }> {
    // Evita faturar/gerar boleto em duplicidade caso o timer, o startup e um disparo manual
    // (POST /contracts/billing/check) se sobreponham enquanto uma execução anterior ainda está rodando.
    if (this.running) {
      this.logger.warn('Verificação de cobrança já em execução, ignorando chamada concorrente.');
      return { processed: 0, billed: 0, errors: 0, skipped: true };
    }
    this.running = true;
    this.logger.log('Iniciando verificação de cobrança de contratos...');
    let processed = 0, billed = 0, errors = 0;

    try {
      // Get active contracts with auto charge enabled
      const contracts = await this.contractRepo.find({
        where: { status: 'ativo', autoCharge: true },
        relations: ['customer'],
      });

      const today = new Date();
      const brToday = new Date(today.getTime() - 3 * 60 * 60 * 1000);
      const currentDay = brToday.getUTCDate();
      const currentMonth = brToday.getUTCMonth();
      const currentYear = brToday.getUTCFullYear();

      for (const contract of contracts) {
        processed++;
        try {
          const chargeDay = contract.chargeDay || 10;

          // Calculate the billing due date for this month
          const dueDate = new Date(currentYear, currentMonth, chargeDay);
          if (dueDate < brToday) {
            // Due date already passed this month, check next month
            dueDate.setMonth(dueDate.getMonth() + 1);
          }

          // Check if today is the issue day for this contract
          const issueDay = contract.issueDay || 3;
          if (currentDay !== issueDay) continue; // Not the issue day

          // Check if already billed for this period — precisa checar o status real da nota/boleto,
          // não apenas se já existe uma linha em contract_billings, senão uma tentativa que falhou
          // (NF rejeitada, por exemplo) nunca mais seria reprocessada automaticamente.
          const billingPeriod = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
          const existingStatus = await this.getBillingStatusForPeriod(contract.id, billingPeriod);

          if (existingStatus.hasNf && existingStatus.hasBoleto) {
            this.logger.log(`Contrato ${contract.title} já faturado para ${billingPeriod}`);
            continue;
          }

          // Generate billing
          await this.generateBilling(contract, dueDate, billingPeriod);
          billed++;
        } catch (error) {
          errors++;
          this.logger.error(`Erro ao faturar contrato ${contract.title}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error('Erro na verificação de cobrança: ' + error.message);
    } finally {
      this.running = false;
    }

    this.logger.log(`Verificação concluída: ${processed} contratos verificados, ${billed} faturados, ${errors} erros`);
    return { processed, billed, errors };
  }

  /**
   * Generate NFS-e + Boleto for a contract
   */
  async generateBilling(contract: Contract, dueDate: Date, billingPeriod: string): Promise<any> {
    const customer = contract.customer;
    if (!customer) throw new Error('Contrato sem cliente vinculado');

    const monthlyValue = Number(contract.monthlyValue || contract.totalValue);
    if (monthlyValue <= 0) throw new Error('Valor mensal do contrato é zero');

    // Calculate boleto value: if ISS is retained by tomador, deduct ISS from boleto
    const issRetido = contract.issRetido || false;
    const issAliquota = Number(contract.issAliquota || 5);
    const issValue = issRetido ? Number((monthlyValue * issAliquota / 100).toFixed(2)) : 0;
    const boletoValue = issRetido ? Number((monthlyValue - issValue).toFixed(2)) : monthlyValue;

    const dueDateStr = dueDate.toISOString().split('T')[0];
    const description = contract.description || contract.title || 'Prestação de serviços de TI';

    this.logger.log(`Gerando cobrança para contrato "${contract.title}" - NF: R$ ${monthlyValue.toFixed(2)} - Boleto: R$ ${boletoValue.toFixed(2)}${issRetido ? ` (ISS retido: R$ ${issValue.toFixed(2)})` : ''} - Venc: ${dueDateStr}`);

    // Reconsulta o estado real (não a mera existência de uma linha em contract_billings) para
    // que uma tentativa anterior que falhou (NF rejeitada ou boleto não criado) seja reprocessada
    // aqui em vez de duplicar a parte que já tinha dado certo.
    const existingStatus = await this.getBillingStatusForPeriod(contract.id, billingPeriod);
    let invoiceId: string | null = existingStatus.hasNf ? existingStatus.invoiceId : null;
    let boletoCode: string | null = existingStatus.hasBoleto ? existingStatus.boletoCode : null;
    let boletoPdf: Buffer | null = null;

    // 1. Try to generate NFS-e (pula se já autorizada em tentativa anterior)
    if (existingStatus.hasNf) {
      this.logger.log(`NFS-e já autorizada para contrato ${contract.title} no período ${billingPeriod}, pulando emissão.`);
    } else
    try {
      // Get active certificate
      const certResult = await this.dataSource.query(
        `SELECT id FROM certificates WHERE is_active = true LIMIT 1`
      );

      if (certResult.length > 0) {
        const certId = certResult[0].id;

        // Create invoice record
        const invoiceResult = await this.dataSource.query(
          `INSERT INTO invoices (sale_id, certificate_id, type, status, recipient_cnpj, recipient_name, total_value)
           VALUES (NULL, $1, 'nfse', 'pendente', $2, $3, $4)
           RETURNING id`,
          [certId, (customer.cpfCnpj || '').replace(/\D/g, ''), customer.name, monthlyValue]
        );

        if (invoiceResult[0]?.id) {
          invoiceId = invoiceResult[0].id;

          // Emit NFS-e
          const nfseResult = await this.nfseService.emit(invoiceId, {
            recipientCnpj: (customer.cpfCnpj || '').replace(/\D/g, ''),
            recipientName: customer.name,
            totalValue: monthlyValue,
            discriminacao: `${description} - Referência: ${billingPeriod}`,
            codTribNacional: '010701',
            aliquota: contract.issAliquota || 5,
            issRetido: contract.issRetido || false,
            recipientEmail: customer.email || '',
            recipientAddress: customer.address || '',
            recipientCity: customer.city || '',
            recipientUf: customer.uf || '',
            recipientNeighborhood: customer.neighborhood || '',
            recipientCep: customer.cep || '',
            recipientCMun: (customer as any).cityCode || '',
          }, certId);

          this.logger.log(`NFS-e emitida: ${nfseResult.status} - #${nfseResult.number || ''}`);
        }
      } else {
        this.logger.warn('Nenhum certificado ativo para emissão de NFS-e');
      }
    } catch (error) {
      this.logger.error(`Erro ao emitir NFS-e para contrato ${contract.title}: ${error.message}`);
    }

    // 2. Generate Boleto via Inter (pula se já existe um boleto ativo para o período)
    if (existingStatus.hasBoleto) {
      this.logger.log(`Boleto já emitido para contrato ${contract.title} no período ${billingPeriod}, pulando geração.`);
    } else
    try {
      if (!customer.cpfCnpj) throw new Error('Cliente sem CPF/CNPJ');

      const tipoPessoa = (customer.cpfCnpj || '').replace(/\D/g, '').length > 11 ? 'JURIDICA' : 'FISICA';
      const seuNumero = contract.id.substring(0, 15);

      const boletoData: any = {
        seuNumero,
        valorNominal: boletoValue,
        dataVencimento: dueDateStr,
        numDiasAgenda: 30,
        pagador: {
          cpfCnpj: (customer.cpfCnpj || '').replace(/\D/g, ''),
          tipoPessoa,
          nome: customer.name.substring(0, 50),
          endereco: (customer.address || 'Endereco nao informado').substring(0, 90),
          cidade: (customer as any).city || 'Contagem',
          uf: (customer as any).uf || 'MG',
          cep: ((customer as any).cep || '32000000').replace(/\D/g, '').padEnd(8, '0').substring(0, 8),
        },
        multa: { codigo: 'PERCENTUAL', taxa: 2 },
        mora: { codigo: 'TAXAMENSAL', taxa: 0.03 },
        mensagem: {
          linha1: `Ref: ${contract.title}`,
          linha2: `Período: ${billingPeriod}`,
          linha3: issRetido ? `ISS retido: R$ ${issValue.toFixed(2)} (${issAliquota}%)` : 'Multa: 2,00% após vencimento',
          linha4: issRetido ? 'Multa: 2,00% / Juros: 0,03% a.m. após vencimento' : 'Juros: 0,03% a.m. após vencimento',
        },
      };

      const boletoResult = await this.interService.createBoleto(boletoData);
      boletoCode = boletoResult.codigoSolicitacao || '';

      this.logger.log(`Boleto gerado: ${boletoCode} - Valor: R$ ${boletoValue.toFixed(2)}`);

      // Save payment record
      if (boletoCode) {
        await this.dataSource.query(
          `INSERT INTO payments (sale_id, customer_id, type, codigo_solicitacao, status, value, customer_name, customer_doc, due_date)
           VALUES (NULL, $1, 'boleto', $2, 'a_receber', $3, $4, $5, $6)`,
          [customer.id, boletoCode, boletoValue, customer.name, (customer.cpfCnpj || '').replace(/\D/g, ''), dueDateStr]
        );

        // Try to get PDF
        try {
          await new Promise(r => setTimeout(r, 3000)); // Wait 3s for Inter to process
          boletoPdf = await this.interService.getBoletoPdf(boletoCode);
        } catch { this.logger.warn('PDF do boleto ainda não disponível'); }
      }
    } catch (error) {
      this.logger.error(`Erro ao gerar boleto para contrato ${contract.title}: ${error.message}`);
    }

    // 3. Save billing record (upsert: generateBilling pode ser reprocessado várias vezes no mesmo
    // período pelo cron de 6h enquanto NF/boleto não estiverem completos, e sem upsert cada
    // tentativa criava uma linha duplicada — o que fazia getBillingStatusForPeriod's LIMIT 1
    // sem ORDER BY retornar uma linha antiga/errada de forma não-determinística).
    await this.dataSource.query(
      `INSERT INTO contract_billings (contract_id, customer_id, billing_period, due_date, value, invoice_id, boleto_code, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (contract_id, billing_period) DO UPDATE SET
         invoice_id = COALESCE(EXCLUDED.invoice_id, contract_billings.invoice_id),
         boleto_code = COALESCE(EXCLUDED.boleto_code, contract_billings.boleto_code),
         updated_at = NOW()`,
      [contract.id, customer.id, billingPeriod, dueDateStr, monthlyValue, invoiceId, boletoCode, 'emitido']
    ).catch(async () => {
      // Table might not exist yet, or exist without the unique constraint (pre-migration deploy).
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS contract_billings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          contract_id UUID REFERENCES contracts(id),
          customer_id UUID REFERENCES customers(id),
          billing_period VARCHAR(10),
          due_date DATE,
          value DECIMAL(10,2),
          invoice_id UUID,
          boleto_code VARCHAR(100),
          status VARCHAR(20) DEFAULT 'emitido',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await this.dataSource.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='uq_contract_billings_contract_period') THEN
          ALTER TABLE contract_billings ADD CONSTRAINT uq_contract_billings_contract_period UNIQUE (contract_id, billing_period);
        END IF;
      END $$`).catch(() => {});
      await this.dataSource.query(
        `INSERT INTO contract_billings (contract_id, customer_id, billing_period, due_date, value, invoice_id, boleto_code, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (contract_id, billing_period) DO UPDATE SET
           invoice_id = COALESCE(EXCLUDED.invoice_id, contract_billings.invoice_id),
           boleto_code = COALESCE(EXCLUDED.boleto_code, contract_billings.boleto_code),
           updated_at = NOW()`,
        [contract.id, customer.id, billingPeriod, dueDateStr, monthlyValue, invoiceId, boletoCode, 'emitido']
      );
    });

    // 4. Send email to customer
    if (customer.email) {
      try {
        const attachments: any[] = [];

        if (boletoPdf) {
          attachments.push({
            filename: `boleto-${billingPeriod}.pdf`,
            content: boletoPdf,
            contentType: 'application/pdf',
          });
        }

        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <div style="background:linear-gradient(90deg,#7c3aed,#5b21b6);padding:20px;border-radius:8px 8px 0 0;text-align:center">
              <h1 style="color:white;margin:0">Fatura do Contrato</h1>
            </div>
            <div style="background:#f9fafb;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
              <p>Olá ${customer.name},</p>
              <p>Segue a cobrança referente ao contrato <strong>${contract.title}</strong>.</p>
              <table style="width:100%;margin:20px 0;border-collapse:collapse">
                <tr><td style="padding:8px;color:#6b7280">Contrato:</td><td style="padding:8px;font-weight:bold">${contract.title}</td></tr>
                <tr><td style="padding:8px;color:#6b7280">Referência:</td><td style="padding:8px;font-weight:bold">${billingPeriod}</td></tr>
                <tr><td style="padding:8px;color:#6b7280">Valor do Serviço:</td><td style="padding:8px;font-weight:bold">R$ ${monthlyValue.toFixed(2)}</td></tr>
                ${issRetido ? `<tr><td style="padding:8px;color:#6b7280">ISS Retido (${issAliquota}%):</td><td style="padding:8px;color:#dc2626">- R$ ${issValue.toFixed(2)}</td></tr>` : ''}
                <tr><td style="padding:8px;color:#6b7280">Valor do Boleto:</td><td style="padding:8px;font-weight:bold;color:#059669">R$ ${boletoValue.toFixed(2)}</td></tr>
                <tr><td style="padding:8px;color:#6b7280">Vencimento:</td><td style="padding:8px;font-weight:bold">${dueDateStr.split('-').reverse().join('/')}</td></tr>
                <tr><td style="padding:8px;color:#6b7280">Descrição:</td><td style="padding:8px">${description}</td></tr>
              </table>
              ${boletoPdf ? '<p>O boleto segue em anexo.</p>' : '<p>O boleto será disponibilizado em breve.</p>'}
              <p style="color:#6b7280;font-size:14px">Efetue o pagamento até a data de vencimento para evitar juros e multa.</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
              <p style="color:#9ca3af;font-size:12px;text-align:center">VGON Soluções em Informática</p>
            </div>
          </div>
        `;

        if (attachments.length > 0) {
          await this.mailService.sendMailWithAttachment(
            customer.email,
            `Fatura ${billingPeriod} - ${contract.title}`,
            html,
            attachments,
          );
        } else {
          await this.mailService.sendMail(
            customer.email,
            `Fatura ${billingPeriod} - ${contract.title}`,
            html,
          );
        }

        this.logger.log(`Email enviado para ${customer.email}`);
      } catch (error) {
        this.logger.error(`Erro ao enviar email: ${error.message}`);
      }
    }

    return { invoiceId, boletoCode, billingPeriod, value: monthlyValue };
  }

  /**
   * Get billing history for a contract
   */
  async getBillingHistory(contractId: string): Promise<any[]> {
    return this.dataSource.query(
      `SELECT * FROM contract_billings WHERE contract_id = $1 ORDER BY created_at DESC`,
      [contractId]
    ).catch(() => []);
  }

  /**
   * Check if NF and Boleto exist for a contract in a given period.
   * Checks both contract_billings table AND directly in invoices/payments.
   */
  async getBillingStatusForPeriod(contractId: string, period: string): Promise<{ hasNf: boolean; hasBoleto: boolean; invoiceId: string | null; boletoCode: string | null; period: string }> {
    if (!period) {
      const now = new Date();
      period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    const [year, month] = period.split('-').map(Number);
    const startDate = `${period}-01`;
    const nextMonthStart = new Date(year, month, 1).toISOString().split('T')[0];

    // Check contract_billings first. Order defensively (most complete row first) in case
    // duplicate rows still exist for this contract+period from before the unique constraint
    // was added — otherwise an unordered LIMIT 1 could non-deterministically return a stale
    // duplicate lacking the invoice_id/boleto_code that another row actually has.
    const billingRecord = await this.dataSource.query(
      `SELECT invoice_id, boleto_code FROM contract_billings WHERE contract_id = $1 AND billing_period = $2
       ORDER BY (invoice_id IS NOT NULL) DESC, (boleto_code IS NOT NULL) DESC, updated_at DESC NULLS LAST, created_at DESC LIMIT 1`,
      [contractId, period]
    ).catch(() => []);

    if (billingRecord[0]) {
      // invoice_id só significa "já emitida" se a nota realmente foi autorizada — emit() não
      // lança exceção quando a prefeitura/Cidade360 rejeita, só marca a invoice como 'rejeitada'
      // e retorna normalmente, então checar apenas a presença de invoice_id travava reemissão.
      let hasNf = false;
      if (billingRecord[0].invoice_id) {
        const invoiceStatus = await this.dataSource.query(
          `SELECT status FROM invoices WHERE id = $1 LIMIT 1`,
          [billingRecord[0].invoice_id]
        ).catch(() => []);
        hasNf = invoiceStatus[0]?.status === 'autorizada';
      }
      let hasBoleto = !!billingRecord[0].boleto_code;
      // Verify the boleto isn't cancelled in payments table
      if (hasBoleto) {
        const boletoStatus = await this.dataSource.query(
          `SELECT status FROM payments WHERE codigo_solicitacao = $1 LIMIT 1`,
          [billingRecord[0].boleto_code]
        ).catch(() => []);
        if (boletoStatus[0]?.status === 'cancelado') {
          hasBoleto = false;
          // Clear the boleto_code in contract_billings since it's cancelled
          await this.dataSource.query(
            `UPDATE contract_billings SET boleto_code = NULL, updated_at = NOW() WHERE contract_id = $1 AND billing_period = $2`,
            [contractId, period]
          ).catch(() => {});
        }
      }

      return {
        hasNf,
        hasBoleto,
        invoiceId: hasNf ? billingRecord[0].invoice_id : null,
        boletoCode: hasBoleto ? billingRecord[0].boleto_code : null,
        period,
      };
    }

    // Fallback: check invoices and payments directly by date + customer
    const contract = await this.contractRepo.findOne({ where: { id: contractId }, relations: ['customer'] });
    if (!contract || !contract.customer) return { hasNf: false, hasBoleto: false, invoiceId: null, boletoCode: null, period };

    const customerDoc = (contract.customer.cpfCnpj || '').replace(/\D/g, '');

    // Check if there's an authorized NFS-e for this customer in this month
    const invoices = await this.dataSource.query(
      `SELECT id FROM invoices WHERE recipient_cnpj = $1 AND type = 'nfse' AND status = 'autorizada'
       AND created_at >= $2 AND created_at < $3 LIMIT 1`,
      [customerDoc || 'NONE', startDate + 'T00:00:00', nextMonthStart + 'T00:00:00']
    ).catch(() => []);

    // Check if there's a boleto payment for this customer in this month
    const payments = await this.dataSource.query(
      `SELECT id, codigo_solicitacao FROM payments WHERE customer_id = $1 AND type = 'boleto' AND status != 'cancelado'
       AND created_at >= $2 AND created_at < $3 LIMIT 1`,
      [contract.customerId || 'NONE', startDate + 'T00:00:00', nextMonthStart + 'T00:00:00']
    ).catch(() => []);

    return {
      hasNf: invoices.length > 0,
      hasBoleto: payments.length > 0,
      invoiceId: invoices[0]?.id || null,
      boletoCode: payments[0]?.codigo_solicitacao || null,
      period,
    };
  }

  /**
   * Manual trigger for a specific contract
   */
  async manualBilling(contractId: string): Promise<any> {
    const contract = await this.contractRepo.findOne({
      where: { id: contractId },
      relations: ['customer'],
    });
    if (!contract) throw new Error('Contrato não encontrado');
    if (contract.status !== 'ativo') throw new Error('Contrato não está ativo');

    const now = new Date();
    const chargeDay = contract.chargeDay || 10;
    const dueDate = new Date(now.getFullYear(), now.getMonth(), chargeDay);
    if (dueDate <= now) dueDate.setMonth(dueDate.getMonth() + 1);
    const billingPeriod = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;

    return this.generateBilling(contract, dueDate, billingPeriod);
  }

  /**
   * Generate only NFS-e for a contract
   */
  async manualNfse(contractId: string): Promise<any> {
    const contract = await this.contractRepo.findOne({
      where: { id: contractId },
      relations: ['customer'],
    });
    if (!contract) throw new Error('Contrato não encontrado');
    if (contract.status !== 'ativo') throw new Error('Contrato não está ativo');
    if (!contract.customer) throw new Error('Contrato sem cliente vinculado');

    const monthlyValue = Number(contract.monthlyValue || contract.totalValue);
    if (monthlyValue <= 0) throw new Error('Valor mensal do contrato é zero');

    const now = new Date();
    const chargeDay = contract.chargeDay || 10;
    const dueDate = new Date(now.getFullYear(), now.getMonth(), chargeDay);
    if (dueDate <= now) dueDate.setMonth(dueDate.getMonth() + 1);
    const billingPeriod = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
    const description = contract.description || contract.title || 'Prestação de serviços de TI';

    // Check if NFS-e already exists for this period (prevent duplicate)
    const existingStatus = await this.getBillingStatusForPeriod(contractId, billingPeriod);
    if (existingStatus.hasNf) {
      throw new Error(`Já existe uma NFS-e emitida para o período ${billingPeriod}. Não é possível emitir novamente.`);
    }

    const certResult = await this.dataSource.query(`SELECT id FROM certificates WHERE is_active = true LIMIT 1`);
    if (certResult.length === 0) throw new Error('Nenhum certificado digital ativo. Configure em Módulo Fiscal > Certificados.');

    const certId = certResult[0].id;
    const customer = contract.customer;

    const invoiceResult = await this.dataSource.query(
      `INSERT INTO invoices (sale_id, certificate_id, type, status, recipient_cnpj, recipient_name, total_value)
       VALUES (NULL, $1, 'nfse', 'pendente', $2, $3, $4) RETURNING id`,
      [certId, (customer.cpfCnpj || '').replace(/\D/g, ''), customer.name, monthlyValue]
    );

    const invoiceId = invoiceResult[0]?.id;
    const nfseResult = await this.nfseService.emit(invoiceId, {
      recipientCnpj: (customer.cpfCnpj || '').replace(/\D/g, ''),
      recipientName: customer.name,
      totalValue: monthlyValue,
      discriminacao: `${description} - Referência: ${billingPeriod}`,
      codTribNacional: '010701',
      aliquota: contract.issAliquota || 5,
      issRetido: contract.issRetido || false,
      recipientEmail: customer.email || '',
      recipientAddress: customer.address || '',
      recipientCity: customer.city || '',
      recipientUf: customer.uf || '',
      recipientNeighborhood: customer.neighborhood || '',
      recipientCep: customer.cep || '',
      recipientCMun: (customer as any).cityCode || '',
    }, certId);

    if (nfseResult.status !== 'autorizada') {
      // emit() não lança exceção em rejeição (só em falha de rede/config), então sem essa checagem
      // a chamada retornava "sucesso" e ainda gravava contract_billings como emitido/travado.
      throw new Error(`Falha ao emitir NFS-e: ${nfseResult.rejectionReason || 'status ' + nfseResult.status}`);
    }

    // Update or create contract_billings record for this period
    await this.dataSource.query(`
      INSERT INTO contract_billings (contract_id, customer_id, billing_period, due_date, value, invoice_id, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'emitido')
      ON CONFLICT (contract_id, billing_period) DO UPDATE SET invoice_id = $6, updated_at = NOW()
    `, [contract.id, customer.id, billingPeriod, dueDate.toISOString().split('T')[0], monthlyValue, invoiceId]).catch(async () => {
      // If ON CONFLICT fails (no unique constraint yet), try upsert manually
      const existing = await this.dataSource.query(`SELECT id FROM contract_billings WHERE contract_id = $1 AND billing_period = $2`, [contract.id, billingPeriod]);
      if (existing[0]) {
        await this.dataSource.query(`UPDATE contract_billings SET invoice_id = $1 WHERE id = $2`, [invoiceId, existing[0].id]);
      } else {
        await this.dataSource.query(
          `INSERT INTO contract_billings (contract_id, customer_id, billing_period, due_date, value, invoice_id, status) VALUES ($1, $2, $3, $4, $5, $6, 'emitido')`,
          [contract.id, customer.id, billingPeriod, dueDate.toISOString().split('T')[0], monthlyValue, invoiceId]
        );
      }
    });

    return { invoiceId, status: nfseResult.status, number: nfseResult.number, billingPeriod, value: monthlyValue };
  }

  /**
   * Generate only Boleto for a contract
   */
  async manualBoleto(contractId: string): Promise<any> {
    const contract = await this.contractRepo.findOne({
      where: { id: contractId },
      relations: ['customer'],
    });
    if (!contract) throw new Error('Contrato não encontrado');
    if (contract.status !== 'ativo') throw new Error('Contrato não está ativo');
    if (!contract.customer) throw new Error('Contrato sem cliente vinculado');

    const customer = contract.customer;
    if (!customer.cpfCnpj) throw new Error('Cliente sem CPF/CNPJ cadastrado');

    const monthlyValue = Number(contract.monthlyValue || contract.totalValue);
    if (monthlyValue <= 0) throw new Error('Valor mensal do contrato é zero');

    const now = new Date();
    const chargeDay = contract.chargeDay || 10;
    const dueDate = new Date(now.getFullYear(), now.getMonth(), chargeDay);
    if (dueDate <= now) dueDate.setMonth(dueDate.getMonth() + 1);
    const dueDateStr = dueDate.toISOString().split('T')[0];
    const billingPeriod = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;

    // Check if Boleto already exists for this period (prevent duplicate)
    const existingStatus = await this.getBillingStatusForPeriod(contractId, billingPeriod);
    if (existingStatus.hasBoleto) {
      throw new Error(`Já existe um boleto emitido para o período ${billingPeriod}. Não é possível emitir novamente.`);
    }

    // Calculate boleto value: if ISS is retained by tomador, deduct ISS from boleto
    const issRetido = contract.issRetido || false;
    const issAliquota = Number(contract.issAliquota || 5);
    const issValue = issRetido ? Number((monthlyValue * issAliquota / 100).toFixed(2)) : 0;
    const boletoValue = issRetido ? Number((monthlyValue - issValue).toFixed(2)) : monthlyValue;

    const tipoPessoa = (customer.cpfCnpj || '').replace(/\D/g, '').length > 11 ? 'JURIDICA' : 'FISICA';

    const boletoData: any = {
      seuNumero: contract.id.substring(0, 15),
      valorNominal: boletoValue,
      dataVencimento: dueDateStr,
      numDiasAgenda: 30,
      pagador: {
        cpfCnpj: (customer.cpfCnpj || '').replace(/\D/g, ''),
        tipoPessoa,
        nome: customer.name.substring(0, 50),
        endereco: (customer.address || 'Endereco nao informado').substring(0, 90),
        cidade: (customer as any).city || 'Contagem',
        uf: (customer as any).uf || 'MG',
        cep: ((customer as any).cep || '32000000').replace(/\D/g, '').padEnd(8, '0').substring(0, 8),
      },
      multa: { codigo: 'PERCENTUAL', taxa: 2 },
      mora: { codigo: 'TAXAMENSAL', taxa: 0.03 },
      mensagem: {
        linha1: `Ref: ${contract.title}`,
        linha2: `Período: ${billingPeriod}`,
        linha3: issRetido ? `ISS retido: R$ ${issValue.toFixed(2)} (${issAliquota}%)` : 'Multa: 2,00% após vencimento',
        linha4: issRetido ? 'Multa: 2,00% / Juros: 0,03% a.m. após vencimento' : 'Juros: 0,03% a.m. após vencimento',
      },
    };

    const boletoResult = await this.interService.createBoleto(boletoData);
    const boletoCode = boletoResult.codigoSolicitacao || '';

    // Save payment record
    if (boletoCode) {
      const existing = await this.dataSource.query(`SELECT id FROM payments WHERE codigo_solicitacao = $1`, [boletoCode]);
      if (existing.length === 0) {
        await this.dataSource.query(
          `INSERT INTO payments (sale_id, customer_id, type, codigo_solicitacao, status, value, customer_name, customer_doc, due_date)
           VALUES (NULL, $1, 'boleto', $2, 'a_receber', $3, $4, $5, $6)`,
          [customer.id, boletoCode, boletoValue, customer.name, (customer.cpfCnpj || '').replace(/\D/g, ''), dueDateStr]
        );
      }
    }

    // Update or create contract_billings record for this period
    await this.dataSource.query(`
      INSERT INTO contract_billings (contract_id, customer_id, billing_period, due_date, value, boleto_code, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'emitido')
      ON CONFLICT (contract_id, billing_period) DO UPDATE SET boleto_code = $6, updated_at = NOW()
    `, [contract.id, customer.id, billingPeriod, dueDateStr, boletoValue, boletoCode]).catch(async () => {
      // If ON CONFLICT fails (no unique constraint yet), try upsert manually
      const existingBilling = await this.dataSource.query(`SELECT id FROM contract_billings WHERE contract_id = $1 AND billing_period = $2`, [contract.id, billingPeriod]);
      if (existingBilling[0]) {
        await this.dataSource.query(`UPDATE contract_billings SET boleto_code = $1 WHERE id = $2`, [boletoCode, existingBilling[0].id]);
      } else {
        await this.dataSource.query(
          `INSERT INTO contract_billings (contract_id, customer_id, billing_period, due_date, value, boleto_code, status) VALUES ($1, $2, $3, $4, $5, $6, 'emitido')`,
          [contract.id, customer.id, billingPeriod, dueDateStr, boletoValue, boletoCode]
        );
      }
    });

    return { boletoCode, billingPeriod, value: boletoValue, serviceValue: monthlyValue, issRetido, issValue, dueDate: dueDateStr };
  }

  /**
   * Send billing email with NF XML + Boleto PDF for a specific period.
   * Works both with contract_billings records AND directly from invoices/payments.
   */
  async sendBillingEmail(contractId: string, billingPeriod: string): Promise<{ sent: boolean }> {
    const contract = await this.contractRepo.findOne({ where: { id: contractId }, relations: ['customer'] });
    if (!contract) throw new Error('Contrato não encontrado');
    if (!contract.customer?.email) throw new Error('Cliente sem email cadastrado');

    // First try to get billing status (which handles both contract_billings and fallback)
    const status = await this.getBillingStatusForPeriod(contractId, billingPeriod);
    if (!status.hasNf && !status.hasBoleto) {
      throw new Error(`Nenhuma NF ou Boleto encontrado para o período ${billingPeriod}. Gere a NF e o Boleto antes de enviar.`);
    }

    const attachments: any[] = [];

    // Get NFS-e XML/PDF from invoiceId (either from contract_billings or direct lookup)
    if (status.invoiceId) {
      const invoice = await this.dataSource.query(
        `SELECT xml_authorized, xml_sent, number, series, access_key, certificate_id FROM invoices WHERE id = $1`, [status.invoiceId]
      );
      if (invoice[0]) {
        const xml = invoice[0].xml_authorized || invoice[0].xml_sent;
        if (xml) {
          attachments.push({
            filename: `NFSe_${invoice[0].number || 'nota'}_serie${invoice[0].series || 1}.xml`,
            content: Buffer.from(xml, 'utf-8'),
            contentType: 'application/xml',
          });
        }
        // Try to get PDF from Cidade360
        if (invoice[0].access_key && invoice[0].certificate_id) {
          try {
            const pdf = await this.nfseService.downloadPdf(invoice[0].access_key, invoice[0].certificate_id);
            attachments.push({
              filename: `NFSe_${invoice[0].number || 'nota'}.pdf`,
              content: pdf,
              contentType: 'application/pdf',
            });
          } catch { /* PDF not available */ }
        }
      }
    } else if (status.hasNf) {
      // Fallback: find NF directly by customer doc + period
      const customerDoc = (contract.customer.cpfCnpj || '').replace(/\D/g, '');
      const [year, month] = billingPeriod.split('-').map(Number);
      const startDate = `${billingPeriod}-01T00:00:00`;
      const nextMonthStart = new Date(year, month, 1).toISOString().split('T')[0] + 'T00:00:00';
      const invoices = await this.dataSource.query(
        `SELECT id, xml_authorized, xml_sent, number, series, access_key, certificate_id FROM invoices
         WHERE recipient_cnpj = $1 AND type = 'nfse' AND status = 'autorizada'
         AND created_at >= $2 AND created_at < $3 ORDER BY created_at DESC LIMIT 1`,
        [customerDoc, startDate, nextMonthStart]
      ).catch(() => []);
      if (invoices[0]) {
        const xml = invoices[0].xml_authorized || invoices[0].xml_sent;
        if (xml) {
          attachments.push({
            filename: `NFSe_${invoices[0].number || 'nota'}_serie${invoices[0].series || 1}.xml`,
            content: Buffer.from(xml, 'utf-8'),
            contentType: 'application/xml',
          });
        }
        if (invoices[0].access_key && invoices[0].certificate_id) {
          try {
            const pdf = await this.nfseService.downloadPdf(invoices[0].access_key, invoices[0].certificate_id);
            attachments.push({
              filename: `NFSe_${invoices[0].number || 'nota'}.pdf`,
              content: pdf,
              contentType: 'application/pdf',
            });
          } catch { /* PDF not available */ }
        }
      }
    }

    // Get Boleto PDF from boletoCode
    if (status.boletoCode) {
      try {
        const pdf = await this.interService.getBoletoPdf(status.boletoCode);
        attachments.push({
          filename: `boleto-${billingPeriod}.pdf`,
          content: pdf,
          contentType: 'application/pdf',
        });
      } catch { /* Boleto PDF not available */ }
    } else if (status.hasBoleto) {
      // Fallback: find boleto by customer + period
      const [year, month] = billingPeriod.split('-').map(Number);
      const startDate = `${billingPeriod}-01T00:00:00`;
      const nextMonthStart = new Date(year, month, 1).toISOString().split('T')[0] + 'T00:00:00';
      const payments = await this.dataSource.query(
        `SELECT codigo_solicitacao FROM payments WHERE customer_id = $1 AND type = 'boleto' AND status != 'cancelado'
         AND created_at >= $2 AND created_at < $3 ORDER BY created_at DESC LIMIT 1`,
        [contract.customerId, startDate, nextMonthStart]
      ).catch(() => []);
      if (payments[0]?.codigo_solicitacao) {
        try {
          const pdf = await this.interService.getBoletoPdf(payments[0].codigo_solicitacao);
          attachments.push({
            filename: `boleto-${billingPeriod}.pdf`,
            content: pdf,
            contentType: 'application/pdf',
          });
        } catch { /* Boleto PDF not available */ }
      }
    }

    if (attachments.length === 0) throw new Error('Nenhum documento disponível para envio (NF ou Boleto não encontrados)');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:linear-gradient(90deg,#7c3aed,#5b21b6);padding:20px;border-radius:8px 8px 0 0;text-align:center">
          <h1 style="color:white;margin:0">Documentos do Contrato</h1>
        </div>
        <div style="background:#f9fafb;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <p>Olá ${contract.customer.name},</p>
          <p>Segue em anexo a Nota Fiscal e o Boleto referente ao contrato <strong>${contract.title}</strong>.</p>
          <table style="width:100%;margin:20px 0;border-collapse:collapse">
            <tr><td style="padding:8px;color:#6b7280">Contrato:</td><td style="padding:8px;font-weight:bold">${contract.title}</td></tr>
            <tr><td style="padding:8px;color:#6b7280">Referência:</td><td style="padding:8px;font-weight:bold">${billingPeriod}</td></tr>
            <tr><td style="padding:8px;color:#6b7280">Valor:</td><td style="padding:8px;font-weight:bold;color:#059669">R$ ${Number(contract.monthlyValue || contract.totalValue || 0).toFixed(2)}</td></tr>
          </table>
          <p style="color:#6b7280;font-size:14px">Efetue o pagamento até a data de vencimento.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
          <p style="color:#9ca3af;font-size:12px;text-align:center">VGON Soluções em Informática</p>
        </div>
      </div>
    `;

    await this.mailService.sendMailWithAttachment(
      contract.customer.email,
      `NF + Boleto - ${contract.title} (${billingPeriod})`,
      html,
      attachments,
    );

    return { sent: true };
  }
}
