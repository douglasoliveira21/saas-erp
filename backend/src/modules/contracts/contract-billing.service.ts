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
  async runBillingCheck(): Promise<{ processed: number; billed: number; errors: number }> {
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

          // Check if we're exactly 7 days before the due date
          const diffDays = Math.ceil((dueDate.getTime() - brToday.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays !== 7) continue; // Not time to bill yet

          // Check if already billed for this period
          const billingPeriod = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
          const existingBilling = await this.dataSource.query(
            `SELECT id FROM contract_billings WHERE contract_id = $1 AND billing_period = $2`,
            [contract.id, billingPeriod]
          ).catch(() => []);

          if (existingBilling.length > 0) {
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

    const dueDateStr = dueDate.toISOString().split('T')[0];
    const description = contract.description || contract.title || 'Prestação de serviços de TI';

    this.logger.log(`Gerando cobrança para contrato "${contract.title}" - R$ ${monthlyValue.toFixed(2)} - Venc: ${dueDateStr}`);

    let invoiceId: string | null = null;
    let boletoCode: string | null = null;
    let boletoPdf: Buffer | null = null;

    // 1. Try to generate NFS-e
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
            aliquota: 5,
            recipientEmail: customer.email || '',
            recipientAddress: customer.address || '',
            recipientCity: customer.city || '',
            recipientUf: customer.uf || '',
            recipientNeighborhood: customer.neighborhood || '',
            recipientCep: customer.cep || '',
          }, certId);

          this.logger.log(`NFS-e emitida: ${nfseResult.status} - #${nfseResult.number || ''}`);
        }
      } else {
        this.logger.warn('Nenhum certificado ativo para emissão de NFS-e');
      }
    } catch (error) {
      this.logger.error(`Erro ao emitir NFS-e para contrato ${contract.title}: ${error.message}`);
    }

    // 2. Generate Boleto via Inter
    try {
      if (!customer.cpfCnpj) throw new Error('Cliente sem CPF/CNPJ');

      const tipoPessoa = (customer.cpfCnpj || '').replace(/\D/g, '').length > 11 ? 'JURIDICA' : 'FISICA';
      const seuNumero = contract.id.substring(0, 15);

      const boletoData: any = {
        seuNumero,
        valorNominal: monthlyValue,
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
          linha3: 'Multa: 2,00% após vencimento',
          linha4: 'Juros: 0,03% a.m. após vencimento',
        },
      };

      const boletoResult = await this.interService.createBoleto(boletoData);
      boletoCode = boletoResult.codigoSolicitacao || '';

      this.logger.log(`Boleto gerado: ${boletoCode}`);

      // Save payment record
      if (boletoCode) {
        await this.dataSource.query(
          `INSERT INTO payments (sale_id, customer_id, type, codigo_solicitacao, status, value, customer_name, customer_doc, due_date)
           VALUES (NULL, $1, 'boleto', $2, 'a_receber', $3, $4, $5, $6)`,
          [customer.id, boletoCode, monthlyValue, customer.name, (customer.cpfCnpj || '').replace(/\D/g, ''), dueDateStr]
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

    // 3. Save billing record
    await this.dataSource.query(
      `INSERT INTO contract_billings (contract_id, customer_id, billing_period, due_date, value, invoice_id, boleto_code, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [contract.id, customer.id, billingPeriod, dueDateStr, monthlyValue, invoiceId, boletoCode, 'emitido']
    ).catch(async () => {
      // Table might not exist, create it
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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await this.dataSource.query(
        `INSERT INTO contract_billings (contract_id, customer_id, billing_period, due_date, value, invoice_id, boleto_code, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
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
                <tr><td style="padding:8px;color:#6b7280">Valor:</td><td style="padding:8px;font-weight:bold;color:#059669">R$ ${monthlyValue.toFixed(2)}</td></tr>
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
      aliquota: 5,
      recipientEmail: customer.email || '',
      recipientAddress: customer.address || '',
      recipientCity: customer.city || '',
      recipientUf: customer.uf || '',
      recipientNeighborhood: customer.neighborhood || '',
      recipientCep: customer.cep || '',
    }, certId);

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

    const tipoPessoa = (customer.cpfCnpj || '').replace(/\D/g, '').length > 11 ? 'JURIDICA' : 'FISICA';

    const boletoData: any = {
      seuNumero: contract.id.substring(0, 15),
      valorNominal: monthlyValue,
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
        linha3: 'Multa: 2,00% após vencimento',
        linha4: 'Juros: 0,03% a.m. após vencimento',
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
          [customer.id, boletoCode, monthlyValue, customer.name, (customer.cpfCnpj || '').replace(/\D/g, ''), dueDateStr]
        );
      }
    }

    return { boletoCode, billingPeriod, value: monthlyValue, dueDate: dueDateStr };
  }
}
