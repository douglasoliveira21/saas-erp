const test = require('node:test');
const assert = require('node:assert/strict');
const { parseXmlEntry, validateXmlEntryPayments } = require('../dist/modules/purchases/xml-entry');
const { XmlEntryService } = require('../dist/modules/purchases/xml-entry.service');
const { ProductsService } = require('../dist/modules/products/products.service');
const { SuppliersService } = require('../dist/modules/suppliers/suppliers.service');
const { TenantContextService } = require('../dist/common/tenant/tenant-context.service');
const { Purchase } = require('../dist/modules/purchases/entities/purchase.entity');
const { Product } = require('../dist/modules/products/entities/product.entity');
const { Bill } = require('../dist/modules/suppliers/entities/bill.entity');
const { FinancialMovement } = require('../dist/modules/financial/entities/financial-movement.entity');
const { StockMovement } = require('../dist/modules/stock/entities/stock-movement.entity');
const { PurchaseItem } = require('../dist/modules/purchases/entities/purchase-item.entity');
const context = new TenantContextService();
const tenantId='11111111-1111-4111-8111-111111111111', otherId='22222222-2222-4222-8222-222222222222';
const document='12345678000100';
const inTenant = fn => context.run(tenantId,fn);
function xml(options={}) {
  const payment = options.payment || '15';
  const duplicates = options.duplicates===false ? '' : '<cobr><dup><nDup>001</nDup><dVenc>2099-01-31</dVenc><vDup>50.00</vDup></dup><dup><nDup>002</nDup><dVenc>2099-02-28</dVenc><vDup>50.01</vDup></dup></cobr>';
  let content=`<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${'1'.repeat(44)}"><ide><mod>55</mod><nNF>123</nNF><dhEmi>2026-11-18T14:00:00-03:00</dhEmi></ide><emit><CNPJ>98765432000100</CNPJ><xNome>Fornecedor Teste</xNome><enderEmit><xLgr>Rua Teste</xLgr><nro>10</nro><xMun>Betim</xMun><UF>MG</UF></enderEmit></emit><dest><CNPJ>${options.document || document}</CNPJ></dest><det nItem="1"><prod><cProd>P001</cProd><xProd>Produto Teste</xProd><qCom>${options.quantity || 2}</qCom><vUnCom>50.005</vUnCom><NCM>84713012</NCM><CFOP>5102</CFOP><uCom>UN</uCom></prod></det><total><ICMSTot><vNF>100.01</vNF></ICMSTot></total>${duplicates}<pag><detPag><tPag>${payment}</tPag><vPag>100.01</vPag></detPag></pag></infNFe></NFe></nfeProc>`;
  if(options.prefix) content=content.replace(/<(\/)?([A-Za-z][A-Za-z0-9]*)/g,'<$1nfe:$2').replace('xmlns=','xmlns:nfe=');
  return content;
}
function fixture(failEntity) {
  let tables = {}; let sequence = 0; let transactions = 0;
  const table = entity => tables[entity.name] || (tables[entity.name]=[]);
  const repo = entity => ({
    create: value => ({...value}),
    find:async ({where}) => table(entity).filter(row=>Object.entries(where).every(([k,v])=>row[k]===v)),
    findOne:async ({where}) => table(entity).find(row=>Object.entries(where).every(([k,v])=>row[k]===v)) || null,
    save:async value => {
      if(entity.name===failEntity) throw new Error('Falha de gravação simulada');
      if(!value.id) value.id=String(++sequence);
      const index=table(entity).findIndex(row=>row.id===value.id);
      if(index<0)table(entity).push(value);else table(entity)[index]=value;
      return value;
    },
    createQueryBuilder:()=>{
      const params={}; const qb={where:(_sql,p)=>{Object.assign(params,p);return qb},andWhere:(_sql,p)=>{Object.assign(params,p);return qb},getOne:async()=>table(entity).find(row=>row.tenantId===params.tenantId && row.cpfCnpj?.replace(/\D/g,'')===params.document) || null};return qb;
    },
  });
  const source={getRepository:entity=>entity.name==='Tenant'?{findOne:async()=>({document})}:repo(entity),transaction:async fn=>{
    transactions++;const snapshot=JSON.parse(JSON.stringify(tables));
    try{return await fn({getRepository:repo,query:async()=>[]})}catch(error){tables=snapshot;throw error;}
  }};
  const products=new ProductsService(null,null);
  return {service:new XmlEntryService(source,context,products),rows:table,get transactions(){return transactions;},seed:(entity,row)=>table(entity).push(row)};
}
const request = () => ({xml:xml(),destination:'product',paymentMethod:'boleto',installments:[{dueDate:'2099-01-31',value:50},{dueDate:'2099-02-28',value:50.01}]});

test('XML com namespace padrão e prefixado preenche pagamento e duplicatas',()=>{
  for(const prefix of [false,true]){
    const data=parseXmlEntry(xml({prefix}));
    assert.equal(data.paymentMethod,'boleto');assert.equal(data.totalValue,100.01);assert.equal(data.items[0].name,'Produto Teste');
    assert.deepEqual(data.installments,[{number:1,dueDate:'2099-01-31',value:50},{number:2,dueDate:'2099-02-28',value:50.01}]);
  }
});
test('formas de pagamento do XML e ausência de vencimento não inventam pagamento ou data',()=>{
  for(const [code,method] of [['01','dinheiro'],['03','cartao_credito'],['17','pix'],['18','transferencia'],['99','outros']])assert.equal(parseXmlEntry(xml({payment:code})).paymentMethod,method);
  const data=parseXmlEntry(xml({duplicates:false}));assert.equal(data.installments[0].dueDate,'');
  assert.throws(()=>validateXmlEntryPayments(data.totalValue,'boleto',data.installments),/data válida/);
});
test('rejeita XML malformado, DTD, nota sem chave e parcelas inconsistentes antes de gravar',()=>{
  for(const content of ['abc','<NFe><infNFe></NFe>','<!DOCTYPE NFe>'+xml(),xml().replace('Id="NFe','Id="BAD')])assert.throws(()=>parseXmlEntry(content));
  assert.throws(()=>validateXmlEntryPayments(100.01,'boleto',[{dueDate:'2099-02-30',value:100.01}]),/data válida/);
  assert.throws(()=>validateXmlEntryPayments(100.01,'boleto',[{dueDate:'2099-01-01',value:100}]),/soma das parcelas/);
  assert.throws(()=>validateXmlEntryPayments(100.01,'boleto',[{dueDate:'2099-01-01',value:100.011}]),/duas casas/);
  assert.throws(()=>validateXmlEntryPayments(100.01,'invalido',[]),/pagamento válida/);
});

test('informa o motivo específico para XML ausente, vazio, grande, HTML ou com DTD',()=>{
  assert.throws(()=>parseXmlEntry(undefined),/não foi recebido corretamente/);
  assert.throws(()=>parseXmlEntry({xml:xml()}),/não foi recebido corretamente/);
  assert.throws(()=>parseXmlEntry('  '),/está vazio/);
  assert.throws(()=>parseXmlEntry('a'.repeat(2_000_001)),/excede o limite de 2 MB/);
  assert.throws(()=>parseXmlEntry('<!DOCTYPE html><html><body>Consulta NF-e</body></html>'),/página HTML/);
  assert.throws(()=>parseXmlEntry('<!DOCTYPE NFe>'+xml()),/declaração DTD ou ENTITY/);
});
test('conferência não altera dados, e destinatário de outro tenant é recusado',()=>inTenant(async()=>{
  const f=fixture();await f.service.preview(xml());assert.equal(f.transactions,0);assert.equal(f.rows(Bill).length,0);
  await assert.rejects(f.service.preview(xml({document:'99999999000199'})),/destinatário/);
}));
test('importação cria estoque, compra e duas contas a pagar com despesas previstas',()=>inTenant(async()=>{
  const f=fixture();const result=await f.service.import(request(),'user');
  assert.equal(result.imported,1);assert.equal(f.rows(Product)[0].quantity,2);
  assert.equal(f.rows(Purchase).length,1);assert.equal(f.rows(PurchaseItem).length,1);assert.equal(f.rows(StockMovement).length,1);
  assert.equal(f.rows(Bill).length,2);assert.equal(f.rows(FinancialMovement).length,2);
  assert.deepEqual(f.rows(Bill).map(row=>row.value),[50,50.01]);assert.deepEqual(f.rows(Bill).map(row=>row.dueDate),['2099-01-31','2099-02-28']);
  for(const bill of f.rows(Bill)){assert.equal(bill.type,'pagar');assert.equal(bill.status,'pendente');assert.equal(bill.paymentMethod,'boleto');assert.equal(bill.tenantId,tenantId)}
  for(const movement of f.rows(FinancialMovement)){assert.equal(movement.type,'despesa');assert.equal(movement.isForecast,true);assert.equal(movement.paidAt,undefined);assert.equal(movement.tenantId,tenantId)}
}));
test('mesma NF-e não duplica estoque nem dívida; erro financeiro desfaz toda a importação',()=>inTenant(async()=>{
  const f=fixture();await f.service.import(request(),'user');
  await assert.rejects(f.service.import(request(),'user'),/já foi importada/);
  assert.equal(f.rows(Product)[0].quantity,2);assert.equal(f.rows(Bill).length,2);
  const broken=fixture('FinancialMovement');await assert.rejects(broken.service.import(request(),'user'),/Falha de gravação/);
  for(const entity of [Purchase,Product,PurchaseItem,StockMovement,Bill,FinancialMovement])assert.equal(broken.rows(entity).length,0,entity.name);
}));
test('produto existente recebe quantidade uma vez e origem anterior permanece registrada',()=>inTenant(async()=>{
  const f=fixture();f.seed(Product,{id:'existing',tenantId,code:'P001',name:'Produto anterior',quantity:5,purchasePrice:10});
  const result=await f.service.import(request(),'user');assert.equal(result.skipped,1);assert.equal(f.rows(Product)[0].quantity,7);
  assert.equal(f.rows(StockMovement)[0].previousQuantity,5);assert.equal(f.rows(StockMovement)[0].newQuantity,7);
}));
test('mesma chave em tenants diferentes é isolada e despesa não movimenta estoque',()=>inTenant(async()=>{
  const f=fixture();await f.service.import({...request(),destination:'expense'},'user');
  await context.run(otherId,()=>f.service.import({...request(),destination:'expense',paymentMethod:'pix'},'other-user'));
  assert.equal(f.rows(Purchase).length,2);assert.equal(f.rows(Bill).length,4);assert.equal(f.rows(Product).length,0);assert.equal(f.rows(StockMovement).length,0);
}));
test('quantidade fracionada e dados financeiros inválidos não deixam cadastro parcial',()=>inTenant(async()=>{
  const f=fixture();await assert.rejects(f.service.import({...request(),xml:xml({quantity:1.5})},'user'),/unidades inteiras/);
  await assert.rejects(f.service.import({...request(),installments:[{dueDate:'',value:100.01}]},'user'),/data válida/);
  assert.equal(f.transactions,0);
}));
test('previsão de compra acompanha pagamento parcial, baixa integral, reversão e cancelamento',async()=>{
  const svc=Object.create(SuppliersService.prototype);let forecasts=[{id:'forecast',isForecast:true,value:100}];
  const manager={getRepository:entity=>entity===Purchase?{findOne:async()=>({competenceDate:'2026-11-18'})}:{find:async()=>forecasts,create:v=>({...v}),save:async v=>{forecasts=[v];return v},remove:async rows=>{forecasts=forecasts.filter(f=>!rows.includes(f))}}};
  const bill={id:'bill',tenantId,purchaseId:'purchase',type:'pagar',value:100,paidValue:40,status:'parcial',dueDate:'2099-01-31',installmentNumber:1,paymentMethod:'boleto'};
  await svc.syncPurchaseForecast(manager,bill);assert.equal(forecasts[0].value,60);
  await svc.syncPurchaseForecast(manager,{...bill,paidValue:100,status:'pago'});assert.equal(forecasts.length,0);
  await svc.syncPurchaseForecast(manager,{...bill,paidValue:0,status:'pendente'});assert.equal(forecasts[0].value,100);assert.equal(forecasts[0].isForecast,true);
  await svc.syncPurchaseForecast(manager,{...bill,status:'cancelado'});assert.equal(forecasts.length,0);
});


test('reabrir XML importado recupera compra e parcelas sem duplicar estoque ou financeiro',async()=>inTenant(async()=>{
  const f=fixture();
  const imported=await f.service.import(request(),'user');
  const before=f.rows(Bill).length,stock=f.rows(StockMovement).length;
  const preview=await f.service.preview(xml());
  assert.equal(preview.purchaseId,imported.purchaseId);
  assert.equal(preview.paymentMethod,'boleto');
  assert.equal(preview.installments.length,2);
  assert.equal(preview.installments[1].dueDate,'2099-02-28');
  assert.equal(f.rows(Bill).length,before);assert.equal(f.rows(StockMovement).length,stock);
}));
