const test = require('node:test');
const assert = require('node:assert/strict');
const { saleEditPlan, normalizeSaleEdit } = require('../dist/modules/sales/sale-edit-plan');
const { SalesService } = require('../dist/modules/sales/sales.service');
const { SaleEvent } = require('../dist/modules/sales/entities/sale-event.entity');
const { Invoice } = require('../dist/modules/fiscal/entities/invoice.entity');
const { FiscalReissueService } = require('../dist/modules/fiscal/services/fiscal-reissue.service');

const base = () => ({
  id: 'sale-1', status: 'boleto_emitido', paymentStatus: 'pendente', fiscalStatus: 'autorizada',
  customerId: 'customer-1', technicianId: 'tech-1', paymentMethod: 'boleto', installments: 1,
  dueDate: '2099-01-10', totalAmount: 100, discountAmount: 0, commissionPercentage: 10,
  multaPercentage: 2, moraPercentage: 0.03, observations: 'Original',
  updatedAt: new Date('2026-01-01'),
  items: [{ serviceId: 'svc', name: 'Serviço', quantity: 1, unitPrice: 100, costPrice: 0, taxPercentage: 0 }],
  activeBoleto: { due_date: '2099-01-10' },
});

test('descrição não cancela documentos; vencimento troca somente boleto; valor e parcelamento trocam ambos', () => {
  const sale = base();
  const plan = changes => saleEditPlan(sale, normalizeSaleEdit(sale, changes), true, true);
  assert.equal(plan({ observations: 'Nova descrição' }).action, 'none');
  assert.equal(plan({ dueDate: '2099-02-10' }).action, 'boleto');
  assert.equal(plan({ installments: 2 }).action, 'documents');
  assert.equal(plan({ items: [{ ...sale.items[0], unitPrice: 200 }] }).action, 'documents');
  assert.equal(plan({ dueDate: '2099-02-10', installments: 2 }).action, 'documents');
  assert.equal(saleEditPlan(sale, normalizeSaleEdit(sale, { dueDate: '2099-02-10' }), false, true).action, 'none');
});

function fixture() {
  const sale = base();
  const events = [];
  const invoices = [{ id: 'invoice-1', saleId: sale.id, status: 'autorizada', certificateId: 'cert', type: 'nfse' }];
  const calls = [];
  let transaction = false;
  let boletoCancelled = false;
  const manager = {
    find: async type => type === Invoice ? invoices.filter(row => row.status === 'autorizada') : [],
    findOne: async () => null,
    findOneByOrFail: async (_type, { id }) => invoices.find(row => row.id === id),
    getRepository: () => ({
      findOne: async () => ({ name: 'Cliente', cpfCnpj: '12345678901', address: 'Rua', city: 'Cidade', uf: 'MG', cep: '30000000' }),
      createQueryBuilder: () => ({ where() { return this; }, andWhere() { return this; }, getOne: async () => null }),
    }),
    save: async (type, value) => {
      if (type === SaleEvent && !events.includes(value)) events.push(value);
      return value;
    },
  };
  const runner = {
    manager, connect: async () => {}, release: async () => {},
    get isTransactionActive() { return transaction; },
    startTransaction: async () => { transaction = true; },
    commitTransaction: async () => { transaction = false; },
    rollbackTransaction: async () => { transaction = false; },
    query: async sql => {
      if (sql.includes('pg_try_advisory_lock')) return [{ locked: true }];
      if (sql.includes('AS paid')) return [{ paid: false }];
      if (sql.startsWith('SELECT id, codigo_solicitacao')) return boletoCancelled ? [] : [{ id: 'payment-1', codigo_solicitacao: 'old-boleto' }];
      if (sql.startsWith('SELECT status FROM payments')) return [{ status: boletoCancelled ? 'cancelado' : 'a_receber' }];
      return [];
    },
  };
  const svc = Object.create(SalesService.prototype);
  Object.assign(svc, {
    dataSource: { createQueryRunner: () => runner },
    findOne: async () => structuredClone(sale),
    saleEventRepository: {
      findOne: async () => events.find(row => row.status === 'pendente') || null,
      create: value => ({ id: 'operation-1', ...value }),
      save: async value => { if (!events.includes(value)) events.push(value); return value; },
      createQueryBuilder: () => ({ where() { return this; }, andWhere() { return this; }, getOne: async () => null }),
    },
    saveSaleEdit: async (_runner, _sale, input) => { calls.push('save-same-sale'); Object.assign(sale, input); },
    auditService: { safeCreate: async () => {} },
    cancelAuthorizedInvoice: async () => { calls.push('cancel-invoice'); invoices[0].status = 'cancelada'; },
    interService: {
      cancelBoleto: async code => { calls.push('cancel-boleto:' + code); boletoCancelled = true; },
      generateForSale: async (s, type, dates, generation) => {
        calls.push('emit-boleto');
        assert.equal(s.id, 'sale-1');
        assert.equal(generation, 'operation-1');
        return {};
      },
    },
    fiscalReissue: {
      prepare: async () => ({ discriminacao: 'Original' }),
      createReplacement: async original => {
        calls.push('create-invoice');
        const row = { id: 'invoice-2', saleId: original.saleId, status: 'pendente', queueStatus: 'aguardando_envio' };
        invoices.push(row);
        return row;
      },
      emitReplacement: async row => { calls.push('emit-invoice'); row.status = 'autorizada'; },
    },
  });
  return { svc, sale, calls, events, invoices, runner };
}

test('salvar somente descrição ignora o banco e o emissor fiscal', async () => {
  const { svc, calls } = fixture();
  const result = await svc.update('sale-1', { observations: 'Editada' }, 'admin', 'admin');
  assert.equal(result.id, 'sale-1');
  assert.deepEqual(calls, ['save-same-sale']);
});

test('venda antiga com vencimento apenas no boleto salva descrição sem troca', async () => {
  const { svc, sale, calls } = fixture();
  sale.dueDate = null;
  await svc.update('sale-1', { observations: 'Editada' }, 'admin', 'admin');
  assert.deepEqual(calls, ['save-same-sale']);
});

test('sem confirmação não cancela nem salva', async () => {
  const { svc, calls } = fixture();
  await assert.rejects(svc.update('sale-1', { dueDate: '2099-02-10' }, 'admin', 'admin'), /Confirme/);
  assert.deepEqual(calls, []);
});

test('data cancela e reemite só boleto na mesma venda', async () => {
  const { svc, calls, invoices } = fixture();
  const result = await svc.update('sale-1', { dueDate: '2099-02-10', confirmDocumentAction: 'boleto' }, 'admin', 'admin');
  assert.equal(result.id, 'sale-1');
  assert.equal(result.dueDate, '2099-02-10');
  assert.equal(invoices[0].status, 'autorizada');
  assert.deepEqual(calls, ['cancel-boleto:old-boleto', 'save-same-sale', 'emit-boleto']);
});

test('parcelamento troca ambos sem criar outra venda', async () => {
  const { svc, calls } = fixture();
  const result = await svc.update('sale-1', { installments: 2, confirmDocumentAction: 'documents' }, 'admin', 'admin');
  assert.equal(result.id, 'sale-1');
  assert.equal(result.installments, 2);
  assert.deepEqual(calls, ['cancel-invoice', 'cancel-boleto:old-boleto', 'save-same-sale', 'create-invoice', 'emit-invoice', 'emit-boleto']);
});

test('falha na reemissão do boleto pode ser retomada sem cancelar novamente a nota', async () => {
  const { svc, calls, events } = fixture();
  const emit = svc.interService.generateForSale;
  svc.interService.generateForSale = async () => { throw new Error('Banco indisponível'); };
  const changes = { installments: 2, confirmDocumentAction: 'documents', editRequestId: 'request-1' };
  await assert.rejects(svc.update('sale-1', changes, 'admin', 'admin'), /Banco indisponível/);
  assert.equal(events[0].metadata.applied, true);
  svc.interService.generateForSale = emit;
  await svc.update('sale-1', changes, 'admin', 'admin');
  assert.equal(calls.filter(call => call === 'cancel-invoice').length, 1);
  assert.equal(calls.filter(call => call === 'create-invoice').length, 1);
  assert.equal(calls.filter(call => call === 'save-same-sale').length, 1);
  assert.equal(events[0].status, 'concluido');
});

test('a rota antiga de substituir venda deixa de criar vendas', async () => {
  await assert.rejects(Object.create(SalesService.prototype).replaceIssuedSale(), /foi removida/);
});

test('reconstrói NFS-e antiga com código de serviço e descritivo originais', async () => {
  const svc = new FiscalReissueService(null, null, null, null);
  const result = await svc.prepare({
    type: 'nfse', certificateId: 'cert', totalValue: 100, taxDetails: { iss: { rate: 2, base: 100 } },
    xmlSent: '<DPS><infDPS><dCompet>2026-10-01</dCompet><toma><end><xLgr>Rua &amp; praça</xLgr><nro>10</nro><CEP>30000000</CEP><cMun>3106200</cMun></end></toma><cTribNac>010701</cTribNac><xDescServ>Manutenção | Pagamento: Boleto em 1 parcela</xDescServ></infDPS></DPS>',
  });
  assert.equal(result.codTribNacional, '010701');
  assert.equal(result.discriminacao, 'Manutenção');
  assert.equal(result.recipientAddress, 'Rua & praça, 10');
  assert.equal(result.aliquota, 2);
});

test('reconstrói NF-e antiga preservando modelo e classificação fiscal', async () => {
  const svc = new FiscalReissueService(null, null, null, null);
  const result = await svc.prepare({
    type: 'nfe', certificateId: 'cert', taxDetails: {},
    xmlSent: '<NFe><ide><mod>65</mod><natOp>VENDA</natOp></ide><det nItem="1"><prod><cProd>P1</cProd><NCM>84713012</NCM><CFOP>5102</CFOP><uCom>UN</uCom></prod><imposto><CSOSN>102</CSOSN></imposto></det></NFe>',
  });
  assert.equal(result.modelo, '65');
  assert.equal(result.items[0].ncm, '84713012');
});


test('não troca documentos quando a confirmação recebida corresponde à ação errada', async () => {
  const { svc, calls } = fixture();
  await assert.rejects(svc.update('sale-1', { installments: 3, confirmDocumentAction: 'boleto' }, 'admin', 'admin'), /Confirme/);
  assert.deepEqual(calls, []);
});

test('falha no cancelamento fiscal preserva a venda e evita cancelar o boleto', async () => {
  const { svc, sale, calls } = fixture();
  svc.cancelAuthorizedInvoice = async () => { throw new Error('Cancelamento recusado'); };
  await assert.rejects(svc.update('sale-1', { installments: 3, confirmDocumentAction: 'documents' }, 'admin', 'admin'), /recusado/);
  assert.equal(sale.installments, 1);
  assert.deepEqual(calls, []);
});

test('uma tentativa parcial bloqueia uma edição diferente', async () => {
  const { svc, events } = fixture();
  svc.interService.generateForSale = async () => { throw new Error('Temporário'); };
  await assert.rejects(svc.update('sale-1', { installments: 2, confirmDocumentAction: 'documents' }, 'admin', 'admin'), /Temporário/);
  assert.equal(events[0].status, 'pendente');
  await assert.rejects(svc.update('sale-1', { installments: 3, confirmDocumentAction: 'documents' }, 'admin', 'admin'), /incompleta/);
});

test('parcelamento recompõe parcelas com centavos e limita o dia ao último do mês', async () => {
  const { AccountReceivable } = require('../dist/modules/financial/entities/account-receivable.entity');
  const { Installment } = require('../dist/modules/financial/entities/installment.entity');
  const { FinancialService } = require('../dist/modules/financial/financial.service');
  const service = Object.create(SalesService.prototype);
  service.financialService = Object.create(FinancialService.prototype);
  service.syncSaleCommission = async () => {};
  const rows = [];
  const updates = [];
  const manager = {
    update: async (type, id, values) => { updates.push({ type, id, values }); },
    findOne: async type => type === AccountReceivable ? { id: 'account-1', paidValue: 0 } : null,
    create: (_type, value) => value,
    save: async (type, value) => { if (type === Installment) rows.push(value); return value; },
    query: async () => [{ due: '2099-01-31' }],
  };
  const sale = base();
  sale.commissionAmount = 10;
  const input = normalizeSaleEdit(sale, { installments: 3, dueDate: '2099-01-31' });
  await service.saveSaleEdit({ manager }, sale, input, saleEditPlan(sale, input, true, true), 'admin');
  assert.deepEqual(rows.map(row => row.value), [33.33, 33.33, 33.34]);
  assert.deepEqual(rows.map(row => row.dueDate), ['2099-01-31', '2099-02-28', '2099-03-31']);
  assert.ok(rows.every(row => row.saleId === sale.id));
  assert.equal(updates.find(row => row.type === AccountReceivable).values.installments, 3);
});

test('troca só de vencimento mantém os valores e o número de parcelas existentes', async () => {
  const { AccountReceivable } = require('../dist/modules/financial/entities/account-receivable.entity');
  const { Installment } = require('../dist/modules/financial/entities/installment.entity');
  const { FinancialService } = require('../dist/modules/financial/financial.service');
  const service = Object.create(SalesService.prototype);
  service.financialService = Object.create(FinancialService.prototype);
  service.syncSaleCommission = async () => {};
  const rows = [{ id: 'parcela-1', number: 1, value: 100, status: 'vencido' }];
  let newInstallments = 0;
  const sale = base();
  sale.commissionAmount = 10;
  const input = normalizeSaleEdit(sale, { dueDate: '2099-02-28' });
  const manager = {
    update: async () => {},
    findOne: async type => type === AccountReceivable ? { id: 'account-1', paidValue: 0 } : null,
    find: async () => rows,
    create: (type, value) => { if (type === Installment) newInstallments++; return value; },
    save: async (_type, value) => value,
    query: async () => [{ due: '2099-02-28' }],
  };
  await service.saveSaleEdit({ manager }, sale, input, saleEditPlan(sale, input, true, true), 'admin');
  assert.equal(newInstallments, 0);
  assert.equal(rows[0].value, 100);
  assert.equal(rows[0].dueDate, '2099-02-28');
  assert.equal(rows[0].status, 'pendente');
});
