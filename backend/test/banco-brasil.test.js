const test = require('node:test');
const assert = require('node:assert/strict');
const { HttpException } = require('@nestjs/common');
const forge = require('node-forge');
const { PDFDocument } = require('pdf-lib');
const { BancoBrasilService, bbDate, bbBoletoStatus } = require('../dist/modules/inter/banco-brasil.service');
const { BbConfigService } = require('../dist/modules/inter/bb-config.service');
const { BbHttpService } = require('../dist/modules/inter/bb-http.service');
const { BbController, SuperAdminBbController } = require('../dist/modules/inter/bb.controller');
const { TenantContextService } = require('../dist/common/tenant/tenant-context.service');
const { renderBbBoleto, bbBarcode } = require('../dist/modules/inter/bb-boleto-pdf');
const { InterService } = require('../dist/modules/inter/inter.service');
const { AuditInterceptor } = require('../dist/modules/audit/audit.interceptor');
const { OperationTrackingService } = require('../dist/modules/operations/operation-tracking.service');
const { of, lastValueFrom } = require('rxjs');
const { decryptField } = require('../dist/common/security/field-encryption');
const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const ID = '33333333-3333-4333-8333-333333333333';
const context = new TenantContextService();
const run = fn => context.run(TENANT, fn);
const settings = { agreement: '3128557', wallet: '17', variation: '35', modality: '1', pixKey: 'chave-da-empresa' };
const boleto = () => ({ seuNumero: 'VENDA-123', valorNominal: 123.45, dataVencimento: '2099-12-20', numDiasAgenda: 30,
  pagador: { cpfCnpj: '12345678901', nome: 'Cliente teste', endereco: 'Rua Teste 123', cidade: 'Contagem', uf: 'MG', cep: '32000000' },
  mora: { taxa: 1 }, multa: { taxa: 2 } });

function fixture() {
  const rows = []; const calls = []; let sequence = 0; let locked = true;
  const configs = [{ row: { id: 'config-1', environment: 'sandbox', active: true, settings }, secrets: {} }];
  let currentConfig = configs[0];
  const repo = {
    findOne: async ({ where }) => rows.find(r => Object.entries(where).every(([k,v]) => r[k] === v)) || null,
    create: value => ({ id: ID, ...value }),
    save: async value => { if (!rows.includes(value)) rows.push(value); return value; },
  };
  const runner = { connect: async () => {}, release: async () => {}, query: async sql => {
    if (sql.includes('pg_try')) return [{ locked }];
    if (sql.includes('nextval')) return [{ number: String(++sequence) }];
    return [];
  } };
  const config = { resolve: async id => {
    const value = id ? configs.find(c => c.row.id === id) : currentConfig;
    assert.ok(value); return value;
  } };
  const http = { call: async (...args) => { calls.push(args); return { numero: rows[0]?.externalId, codigoEstadoTituloCobranca: 1, linhaDigitavel: '00190000000000000000000000000000000000000000000' }; } };
  const service = new BancoBrasilService(config, http, repo, { createQueryRunner: () => runner }, context);
  service.reserveNumber = async () => {}; // Exercitado separadamente com colisões abaixo.
  return { service, rows, calls, http, config, configs, setConfig: c => { configs.push(c); currentConfig = c; }, lock: b => { locked = b; } };
}

test('datas BB e baixa não confundem cancelamento com pagamento', () => {
  assert.equal(bbDate('2099-12-20'), '20.12.2099');
  assert.throws(() => bbDate('2026-02-30'));
  assert.equal(bbBoletoStatus(7), 'CANCELADO');
  for (const code of [6,10,11,12]) assert.equal(bbBoletoStatus(code), 'PAGO');
  for (const code of [5,18,99]) assert.equal(bbBoletoStatus(code), 'A_RECEBER');
});

test('reserva de número não adota boleto preexistente de outro emissor', () => run(async () => {
  const f = fixture(); const seen = [];
  const charge = { kind:'boleto',externalId:'00031285570000000001',payload:{numeroTituloCliente:'00031285570000000001'} };
  f.service.source = { query:async () => [{number:'2'}] };
  f.http.call = async (_c,_k,_m,path) => { seen.push(path); if (path.endsWith('02')) throw new HttpException('Não encontrado',404); return {codigoEstadoTituloCobranca:6}; };
  await BancoBrasilService.prototype.reserveNumber.call(f.service,charge,f.configs[0]);
  assert.deepEqual(seen,['/boletos/00031285570000000001','/boletos/00031285570000000002']);
  assert.equal(charge.payload.numeroTituloCliente,'00031285570000000002');
}));

test('referências de meses de contrato diferentes não se confundem', () => run(async () => {
  const f = fixture();
  await f.service.createBoleto(boleto(),'contract:123:2026-11:due:2099-12-20');
  await f.service.createBoleto(boleto(),'contract:123:2026-12:due:2099-12-20');
  assert.equal(f.rows.length,2);
  assert.notEqual(f.rows[0].externalId,f.rows[1].externalId);
}));

test('emissão BB mapeia convênio, juros e multa, repetição usa a mesma cobrança', () => run(async () => {
  const f = fixture();
  const first = await f.service.createBoleto(boleto());
  const second = await f.service.createBoleto(boleto());
  assert.equal(first.codigoSolicitacao, 'bb:' + ID);
  assert.equal(first.codigoSolicitacao, second.codigoSolicitacao);
  assert.equal(f.calls.length,1);
  assert.equal(f.rows[0].externalId, '00031285570000000001');
  const p = f.rows[0].payload;
  assert.equal(p.jurosMora.porcentagem,1); assert.equal(p.multa.porcentagem,2);
  assert.equal(p.multa.data,'21.12.2099'); assert.equal(p.numeroDiasLimiteRecebimento,30);
  assert.equal(p.numeroTituloBeneficiario,'VENDA123');
}));

test('queda depois do registro consulta o mesmo número antes de reenviar', () => run(async () => {
  const f = fixture();
  f.http.call = async (...args) => {
    f.calls.push(args);
    if (args[2] === 'POST') throw new HttpException('Tempo limite',503);
    return { codigoEstadoTituloCobranca: 1 };
  };
  await assert.rejects(f.service.createBoleto(boleto()));
  const result = await f.service.createBoleto(boleto());
  assert.equal(result.codigoSolicitacao,'bb:' + ID);
  assert.deepEqual(f.calls.map(c => c[2]),['POST','GET']);
  assert.equal(f.rows.length,1);
}));

test('404 após falha reenvia com o mesmo nosso número', () => run(async () => {
  const f = fixture(); let attempts = 0;
  f.http.call = async (...args) => {
    f.calls.push(args);
    if (args[2] === 'GET') throw new HttpException('Não encontrado',404);
    if (++attempts === 1) throw new HttpException('Timeout',503);
    return {numero:'00031285570000000001'};
  };
  await assert.rejects(f.service.createBoleto(boleto()));
  await f.service.createBoleto(boleto());
  assert.deepEqual(f.calls.map(c => c[2]),['POST','GET','POST']);
  assert.equal(f.calls[0][4].numeroTituloCliente,f.calls[2][4].numeroTituloCliente);
}));

test('dados de uma cobrança emitida não são alterados em repetição', () => run(async () => {
  const f = fixture(); await f.service.createBoleto(boleto());
  await assert.rejects(f.service.createBoleto({ ...boleto(), valorNominal: 500 }), /dados diferentes/);
  assert.equal(f.calls.length,1);
}));

test('rejeição definitiva permite corrigir o cadastro preservando o número', () => run(async () => {
  const f = fixture(); let attempts = 0;
  f.http.call = async (...args) => { f.calls.push(args); if (++attempts === 1) throw new HttpException('CEP inválido',400); return {numero:'00031285570000000001'}; };
  await assert.rejects(f.service.createBoleto(boleto()));
  const corrected = boleto(); corrected.pagador.cep = '32001000';
  await f.service.createBoleto(corrected);
  assert.equal(f.rows.length,1); assert.equal(f.rows[0].payload.pagador.cep,32001000);
  assert.equal(f.calls[0][4].numeroTituloCliente,f.calls[1][4].numeroTituloCliente);
}));

test('trocar credenciais mantém a configuração original de cobranças antigas', () => run(async () => {
  const f = fixture(); const result = await f.service.createBoleto(boleto());
  f.setConfig({ row: { id: 'config-2', settings: { ...settings, agreement: '1234567' } }, secrets: {} });
  await f.service.get(result.codigoSolicitacao,'boleto');
  assert.equal(f.calls[1][0].row.id,'config-1');
  assert.equal(f.calls[1][5].numeroConvenio,'3128557');
}));

test('tenant diferente não consulta nem cancela a cobrança', () => run(async () => {
  const f = fixture(); const result = await f.service.createBoleto(boleto());
  await context.run(OTHER, async () => {
    await assert.rejects(f.service.get(result.codigoSolicitacao,'boleto'), /não encontrada/);
    await assert.rejects(f.service.cancel(result.codigoSolicitacao,'boleto'), /não encontrada/);
  });
  assert.equal(f.calls.length,1);
}));

test('concorrência bloqueia emissão e erro no cancelamento não marca como cancelado', () => run(async () => {
  const f = fixture(); f.lock(false);
  await assert.rejects(f.service.createBoleto(boleto()), /sendo emitida/);
  assert.equal(f.calls.length,0);
  f.lock(true); const result = await f.service.createBoleto(boleto());
  f.http.call = async (_c,_k,method) => { if (method === 'POST') throw new HttpException('Aguarde 30 minutos',400); return { codigoEstadoTituloCobranca:1 }; };
  await assert.rejects(f.service.cancel(result.codigoSolicitacao,'boleto'), /30 minutos/);
  assert.equal(f.rows[0].state,'emitido');
}));

test('Pix usa PUT com txid estável, chave do tenant e status pago explícito', () => run(async () => {
  const f = fixture();
  f.http.call = async (...args) => { f.calls.push(args); return { status: args[2]==='GET' ? 'CONCLUIDA' : 'ATIVA', pixCopiaECola:'000201teste', pix:[{valor:'12.30'}] }; };
  const result = await f.service.createPix({ valor:{original:'12.30'}, chave:'ignorar' }, 'sale:123:pix');
  assert.equal(f.calls[0][2],'PUT');
  assert.match(f.calls[0][3],/^\/cob\/[a-f0-9]{32}$/);
  assert.equal(f.calls[0][4].chave,settings.pixKey);
  assert.equal(result.pixCopiaECola,'000201teste');
  const paid = await f.service.get(result.txid,'pix');
  assert.equal(paid.status,'CONCLUIDA'); assert.equal(paid.valorTotalRecebido,12.3);
}));

test('consulta antiga continua roteada para BB mesmo com banco atual diferente', async () => {
  const svc = Object.create(InterService.prototype); let calls = 0;
  svc.bb = { config:{isSelected:async () => false}, get:async (code, kind, tenant) => { calls++; return {code,kind,tenant}; }, pdf:async () => Buffer.from('%PDF') };
  assert.deepEqual(await svc.getBoleto('bb:' + ID,TENANT),{code:'bb:' + ID,kind:'boleto',tenant:TENANT});
  assert.equal((await svc.getBoletoPdf('bb:' + ID)).toString(),'%PDF');
  assert.equal(calls,1);
});

test('HTTP BB isola cache por credencial e escopo, e Pix exige A1', async () => {
  const http = new BbHttpService(); const calls = [];
  http.send = async (...args) => { calls.push(args); return { access_token: 'token-' + calls.length, expires_in:300 }; };
  const config = { row:{id:'a',environment:'sandbox'}, secrets:{clientId:'id',clientSecret:'secret',appKey:'app'} };
  await assert.rejects(http.token(config,'cob.write'), /A1/);
  const a = await http.token(config,'cobrancas.boletos-info');
  assert.equal(await http.token(config,'cobrancas.boletos-info'),a);
  const b = await http.token({...config,row:{...config.row,id:'b'}},'cobrancas.boletos-info');
  assert.notEqual(a,b);
  await http.token(config,'cobrancas.boletos-requisicao'); assert.equal(calls.length,3);
  assert.equal(calls[0][0].hostname,'oauth.hm.bb.com.br');
  assert.equal(new URLSearchParams(calls[0][3]).get('scope'),'cobrancas.boletos-info');
});

function configFixture() {
  const rows = [];
  const repo = { findOne:async ({where}) => rows.find(r => Object.entries(where).every(([k,v]) => r[k]===v)) || null };
  const manager = { getRepository:() => repo, query:async () => [], update:async (_entity,where,values) => rows.filter(r => Object.entries(where).every(([k,v]) => r[k]===v)).forEach(r => Object.assign(r,values)), create:(_e,v) => ({id:String(rows.length+1),...v}), save:async (_e,v) => { rows.push(v); return v; } };
  return { rows, service: new BbConfigService(repo,{transaction:async fn => fn(manager)},context) };
}

test('configuração criptografada preserva segredos em edições com campos vazios', () => run(async () => {
  const f = configFixture();
  await f.service.save({ clientId:'client-id', clientSecret:'segredo-123', appKey:'app-key', environment:'sandbox', active:true,settings });
  assert.ok(f.rows[0].credentials.startsWith('enc:v1:'));
  assert.ok(!f.rows[0].credentials.includes('segredo-123'));
  await f.service.save({ clientSecret:'', settings:{wallet:'18'} });
  const result = await f.service.publicConfig();
  assert.equal(result.hasClientSecret,true); assert.equal(result.active,true); assert.equal(result.settings.wallet,'18');
  assert.equal(f.rows[0].current,false); assert.equal(f.rows[1].current,true);
  assert.equal(JSON.parse(decryptField(f.rows[1].credentials,['development-only-CREDENTIAL_ENCRYPTION_KEY'])).clientSecret,'segredo-123');
  assert.ok(!JSON.stringify(result).includes('segredo-123'));
  await context.run(OTHER, async () => assert.equal((await f.service.publicConfig()).configured,false));
}));

test('PFX é convertido para PEM válido sem persistir senha do arquivo', () => run(async () => {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate(); cert.publicKey = keys.publicKey; cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now()-60000); cert.validity.notAfter = new Date(Date.now()+86400000);
  cert.setSubject([{name:'commonName',value:'Teste empresa'}]); cert.setIssuer(cert.subject.attributes); cert.sign(keys.privateKey,forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey,[cert],'senha-do-a1',{algorithm:'3des'});
  const pfxBase64 = forge.util.encode64(forge.asn1.toDer(p12).getBytes());
  const f = configFixture();
  await assert.rejects(f.service.save({clientId:'id',clientSecret:'s',appKey:'a',pfxBase64,pfxPassword:'errada'}), /PFX/);
  await f.service.save({clientId:'id',clientSecret:'s',appKey:'a',pfxBase64,pfxPassword:'senha-do-a1'});
  const data = JSON.parse(decryptField(f.rows[0].credentials,['development-only-CREDENTIAL_ENCRYPTION_KEY']));
  assert.match(data.certificate,/BEGIN CERTIFICATE/); assert.match(data.privateKey,/PRIVATE KEY/);
  assert.ok(!JSON.stringify(data).includes('senha-do-a1')); assert.equal((await f.service.publicConfig()).hasCertificate,true);
}));

test('PDF utiliza dados registrados e recusa linha digitável inconsistente', async () => {
  const response = { linhaDigitavel:'00190000090364154600100001376177797530000003060' };
  const { barcode } = bbBarcode(response); assert.equal(barcode.length,44);
  assert.throws(() => bbBarcode({...response,codigoBarraNumerico:'0019'+'1'.repeat(40)}), /conferem/);
  const charge = { payload:{pagador:{nome:'Cliente teste',numeroInscricao:12345678901,tipoInscricao:1,endereco:'Rua Teste 123',cidade:'Contagem',uf:'MG',cep:32000000},dataVencimento:'20.12.2099',dataEmissao:'16.11.2026',valorOriginal:30.60,numeroTituloBeneficiario:'VENDA123',numeroCarteira:17}, response, externalId:'00031285570000000001' };
  const buffer = await renderBbBoleto(charge,{beneficiaryName:'Empresa teste',beneficiaryDocument:'12345678000100',agency:'1234',account:'12345-6'},'sandbox');
  assert.equal(buffer.subarray(0,4).toString(),'%PDF');
  const pdf = await PDFDocument.load(buffer); assert.equal(pdf.getPageCount(),1);
});

test('rotas de configuração exigem guardas e super admin não encontra tenant inexistente', async () => {
  assert.equal(Reflect.getMetadata('__guards__',BbController).length,3);
  assert.equal(Reflect.getMetadata('__guards__',SuperAdminBbController).length,1);
  const controller = new SuperAdminBbController({config:{save:() => assert.fail('Não salvar')}},{getRepository:() => ({findOne:async () => null})},context);
  await assert.rejects(controller.save(TENANT,{}),/não encontrada/);
});

test('auditoria e operações nunca gravam PFX, chave privada ou credenciais BB em texto', async () => {
  const body = { clientId:'id-oculto',appKey:'app-oculto',clientSecret:'secret-oculto',privateKey:'key-oculta',pfxBase64:'pfx-oculto',pfxPassword:'senha-oculta',settings:{agreement:'3128557'} };
  let audit;
  const interceptor = new AuditInterceptor({safeCreate:async row => { audit = row; }});
  const request = {method:'POST',path:'/api/bb/bank-config',originalUrl:'/api/bb/bank-config',body};
  await lastValueFrom(interceptor.intercept({switchToHttp:() => ({getRequest:() => request})},{handle:() => of({success:true})}));
  const tracking = new OperationTrackingService({});
  const serialized = JSON.stringify([audit.newData,tracking.sanitize(body)]);
  for (const value of Object.values(body).filter(v => typeof v === 'string')) assert.ok(!serialized.includes(value));
  assert.ok(serialized.includes('3128557'));
});

test('resposta vazia do banco não confirma emissão nem pagamento', () => run(async () => {
  const f = fixture(); f.http.call = async () => ({});
  await assert.rejects(f.service.createBoleto(boleto()), /sem confirmar/);
  assert.equal(f.rows[0].state,'enviando');
  await assert.rejects(f.service.get('bb:' + ID,'boleto'), /sem situação válida/);
}));

test('reemissão vincula o novo código e vencimento à parcela com parâmetros SQL completos', async () => {
  const svc = Object.create(InterService.prototype); let inserted;
  const payment = {id:'payment-old',sale_id:ID,customer_id:OTHER,type:'boleto',codigo_solicitacao:'old',status:'vencido',value:30.6};
  const manager = { query:async (sql,params) => {
    if (sql.includes('SELECT id, sale_id, customer_id')) return [payment];
    if (sql.includes('SELECT i.id, i.account_id')) return [{id:'installment',account_id:'account',status:'pendente'}];
    if (sql.includes('INSERT INTO payments')) {
      const columns = sql.match(/payments \(([^)]+)\)/)[1].split(',').map(s => s.trim());
      const values = sql.match(/VALUES \(([^)]+)\)/)[1].split(',').map(s => s.trim());
      assert.equal(columns.length,values.length);
      assert.equal(Math.max(...sql.match(/\$\d+/g).map(s => Number(s.slice(1)))),params.length);
      inserted = Object.fromEntries(columns.map((col,i) => [col,values[i].startsWith('$') ? params[Number(values[i].slice(1))-1] : values[i].replace(/'/g,'')]));
      return [{id:'payment-new'}];
    }
    return [];
  } };
  manager.transaction = fn => fn(manager);
  svc.saleRepo = {manager,findOne:async () => ({customer:{id:OTHER,name:'Cliente teste',cpfCnpj:'12345678901',address:'Rua Teste',city:'Contagem',uf:'MG',cep:'32000000'}})};
  svc.currentTenantId = () => TENANT; svc.cancelBoleto = async () => {}; svc.auditInter = async () => {};
  svc.createBoleto = async () => ({codigoSolicitacao:'bb:' + ID,linhaDigitavel:'linha',nossoNumero:'numero'});
  svc.logger = {warn() {}};
  const result = await svc.reissuePayment('payment-old','2099-12-20',undefined);
  assert.equal(result.newPaymentId,'payment-new'); assert.equal(inserted.codigo_solicitacao,'bb:' + ID);
  assert.equal(inserted.status,'a_receber'); assert.equal(inserted.due_date,'2099-12-20');
  assert.equal(inserted.value,30.6); assert.equal(inserted.installment_id,'installment');
  assert.equal(inserted.tenant_id,TENANT); assert.equal(inserted.account_id,'account');
});
