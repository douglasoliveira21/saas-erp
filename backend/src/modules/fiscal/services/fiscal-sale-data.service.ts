import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Raw, Repository } from 'typeorm';
import { Invoice } from '../entities/invoice.entity';
import { Sale } from '../../sales/entities/sale.entity';
import { Product } from '../../products/entities/product.entity';
import { getCustomerEmails } from '../../../common/customer-emails';
import { currentTenantId } from '../../../common/tenant/tenant-context.service';
import { Purchase } from '../../purchases/entities/purchase.entity';
import { Bill } from '../../suppliers/entities/bill.entity';
import { parseXmlEntry, validateXmlEntryPayments, XML_PAYMENT_CODES } from '../../purchases/xml-entry';

@Injectable()
export class FiscalSaleDataService {
  constructor(
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    @InjectRepository(Sale) private saleRepo: Repository<Sale>,
  ) {}
  async validateSaleForInvoice(saleId: string, type: 'nfe' | 'nfse', submitted: any, allowActive = false): Promise<any> {
    if (type === 'nfe' && String(submitted?.tpNF) === '0') {
      if (saleId) throw new BadRequestException('A nota de entrada deve ser vinculada à compra importada, sem venda vinculada.');
      return this.validateImportedEntry(submitted);
    }
    if (!saleId) throw new BadRequestException('Venda obrigatória para emissão');
    const sale = await this.saleRepo.findOne({ where: { id: saleId }, relations: ['customer', 'items'] });
    if (!sale) throw new BadRequestException('Venda não encontrada');
    if (!allowActive) {
      const [pending] = await this.saleRepo.manager.query(
        "SELECT id FROM sale_events WHERE sale_id=$1 AND type='sale.documents_edit' AND status='pendente' LIMIT 1", [saleId],
      );
      if (pending) throw new BadRequestException('Há uma atualização de documentos em andamento. Retome a edição da venda para concluir.');
    }
    if (['cancelada','finalizada'].includes(sale.operationalStatus) || ['cancelado','finalizado'].includes(sale.status as any)) throw new BadRequestException('Venda finalizada ou cancelada não pode emitir nota');
    const now = new Date(); const today = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
    if (sale.dueDate && sale.dueDate < today) throw new BadRequestException('Não é permitido emitir nota para venda com vencimento anterior a hoje');
    const duplicate = await this.invoiceRepo.findOne({ where: { saleId, type, status: In(['autorizada', 'processando', 'pendente']) } });
    if (!allowActive && duplicate && !['cancelada', 'rejeitada', 'erro'].includes(duplicate.status)) throw new BadRequestException(`Já existe ${type.toUpperCase()} ativa para esta venda`);
    if (!sale.customer) throw new BadRequestException('Venda sem cliente');
    // O codigo (cProd) e os dados fiscais do item vem do cadastro do produto. A tela manda o ID interno (UUID) no campo
    // "code", que nao pode ir para a nota.
    const productIds = sale.items.map((item) => item.productId).filter(Boolean);
    const products = productIds.length ? await this.saleRepo.manager.getRepository(Product).find({ where: { id: In(productIds) } }) : [];
    const productById = new Map(products.map((product) => [product.id, product]));
    const items = sale.items.map((item, index) => {
      const sub = submitted?.items?.[index] || {};
      const product = item.productId ? productById.get(item.productId) : undefined;
      return {
        ...sub,
        code: product?.code || (sub.code && sub.code !== item.productId ? sub.code : String(index + 1)),
        ncm: sub.ncm || product?.ncm || '',
        cfop: sub.cfop || product?.cfop || '',
        cest: sub.cest || product?.cest || '',
        unit: product?.unit || sub.unit || 'UN',
        productId: item.productId, serviceId: item.serviceId, name: item.name, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), totalPrice: Number(item.totalPrice),
      };
    });
    const paymentCodes: Record<string, string> = { dinheiro: '01', cheque: '02', cartao_credito: '03', cartao_debito: '04', boleto: '15', pix: '17', transferencia: '18' };
    const paymentLabels: Record<string, string> = { dinheiro: 'Dinheiro', cheque: 'Cheque', cartao_credito: 'Cartão de crédito', cartao_debito: 'Cartão de débito', boleto: 'Boleto bancário', pix: 'PIX', transferencia: 'Transferência bancária' };
    const paymentInstallments = await this.invoiceRepo.manager.query(
      `SELECT number, value, due_date AS "dueDate" FROM installments WHERE sale_id=$1 AND status!='cancelado' ORDER BY number`, [saleId]);
    const installments = Math.max(1, Number(sale.installments || paymentInstallments.length || 1));
    const paymentMethodLabel = paymentLabels[String(sale.paymentMethod)] || String(sale.paymentMethod || 'Outros');
    let discriminacao = submitted?.discriminacao;
    if (type === 'nfse') {
      const schedule = paymentInstallments.map((item: any) => `${item.number}ª: R$ ${Number(item.value).toFixed(2)} venc. ${String(item.dueDate).substring(0, 10).split('-').reverse().join('/')}`).join('; ');
      discriminacao = `${discriminacao || 'Serviços prestados'} | Pagamento: ${paymentMethodLabel}${installments > 1 ? ` em ${installments} parcelas (${schedule})` : ''}`;
    }
    return {
      ...(submitted || {}),
      recipientCnpj: sale.customer.cpfCnpj,
      recipientName: sale.customer.name,
      recipientEmail: sale.customer.email,
      recipientEmails: getCustomerEmails(sale.customer),
      // O município do tomador é independente do município do prestador. Sem
      // esse código o XML caía no cityCode da empresa e o Emissor Nacional
      // rejeitava CEPs válidos de outras cidades (E0240).
      recipientCityCode: sale.customer.cityCode || submitted?.recipientCityCode || '',
      totalValue: Number(sale.totalAmount), items, paymentMethod: sale.paymentMethod,
      paymentMethodLabel, tPag: paymentCodes[String(sale.paymentMethod)] || '99',
      installments, paymentInstallments, discriminacao,
    };
  }

  private async validateImportedEntry(submitted: any) {
    const tenantId = currentTenantId();
    if (!tenantId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(submitted?.purchaseId || ''))) throw new BadRequestException('Confirme a importação do XML antes de emitir a nota de entrada.');
    const purchase = await this.invoiceRepo.manager.getRepository(Purchase).findOne({
      where: { id: submitted.purchaseId, tenantId }, select: { id:true, tenantId:true, importedXml:true, totalValue:true, status:true, financialStatus:true, paymentMethod:true },
    });
    if (!purchase?.importedXml || purchase.status !== 'recebido' || !['generated','partially_paid','paid'].includes(purchase.financialStatus)) throw new BadRequestException('Compra importada não encontrada ou sem financeiro ativo.');
    const source = parseXmlEntry(purchase.importedXml);
    if (String(submitted.modelo) !== '55' || Number(submitted.totalValue) !== Number(purchase.totalValue) || String(submitted.recipientCnpj || '').replace(/\D/g,'') !== source.supplierDocument) throw new BadRequestException('Confira o modelo 55, o fornecedor e o total da compra importada.');
    const duplicate = await this.invoiceRepo.findOne({ where: {
      tenantId, type:'nfe', status:In(['autorizada','pendente','processando']),
      taxDetails:Raw(alias => `${alias}->'emissionInput'->>'purchaseId' = :purchaseId`, {purchaseId:purchase.id}),
    } });
    if (duplicate) throw new BadRequestException('Já existe NF-e ativa para esta entrada. Consulte a nota antes de emitir novamente.');
    const bills = await this.invoiceRepo.manager.getRepository(Bill).find({ where:{tenantId,purchaseId:purchase.id,type:'pagar'}, order:{installmentNumber:'ASC'} });
    const schedule = bills.filter(row=>row.status !== 'cancelado').map(row=>({number:row.installmentNumber,dueDate:row.dueDate,value:Number(row.value)}));
    const paymentInstallments = validateXmlEntryPayments(Number(purchase.totalValue),purchase.paymentMethod,schedule);
    if (!Array.isArray(submitted.items) || submitted.items.length !== source.items.length) throw new BadRequestException('Confira os itens da nota de entrada.');
    const items = source.items.map((item,index)=> {
      const edited = submitted.items[index];
      if (!/^\d{8}$/.test(edited?.ncm || '') || !/^[123]\d{3}$/.test(edited?.cfop || '')) throw new BadRequestException(`Informe o NCM e o CFOP de entrada do item ${index+1} (${item.name}).`);
      return {...item,ncm:edited.ncm,cfop:edited.cfop};
    });
    const tPag = Object.entries(XML_PAYMENT_CODES).find(([,method])=>method===purchase.paymentMethod)?.[0] || '99';
    return {...submitted, purchaseId:purchase.id, tpNF:'0',modelo:'55',items, totalValue:Number(purchase.totalValue), tPag,
      paymentMethod:purchase.paymentMethod, installments:paymentInstallments.length,paymentInstallments};
  }

  calculateNfseTaxes(serviceData: any): Record<string, any> {
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

}

