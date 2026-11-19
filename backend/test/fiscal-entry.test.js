const test = require('node:test');
const assert = require('node:assert/strict');
const { FiscalSaleDataService } = require('../dist/modules/fiscal/services/fiscal-sale-data.service');
const { DanfePdfService } = require('../dist/modules/fiscal/services/danfe-pdf.service');
const { FiscalController } = require('../dist/modules/fiscal/fiscal.controller');
const { NfeService } = require('../dist/modules/fiscal/services/nfe.service');
const { parseXmlEntry } = require('../dist/modules/purchases/xml-entry');
const { runInTenant } = require('../dist/common/tenant/tenant-context.service');
const tenantId='11111111-1111-4111-8111-111111111111', purchaseId='22222222-2222-4222-8222-222222222222';
const xml=`<NFe><infNFe Id="NFe${'1'.repeat(44)}"><ide><mod>55</mod><nNF>123</nNF><dEmi>2026-11-19</dEmi></ide><emit><CNPJ>98765432000100</CNPJ><xNome>Fornecedor</xNome><IE>123456</IE><enderEmit><xLgr>Rua Teste</xLgr><nro>10</nro><xBairro>Centro</xBairro><cMun>3106705</cMun><xMun>Betim</xMun><UF>MG</UF><CEP>32600000</CEP><fone>3133334444</fone></enderEmit></emit><det><prod><cProd>P01</cProd><xProd>Produto da entrada</xProd><qCom>2</qCom><vUnCom>50</vUnCom><NCM>84713012</NCM><CFOP>5102</CFOP><uCom>UN</uCom></prod></det><total><ICMSTot><vNF>100</vNF></ICMSTot></total></infNFe></NFe>`;
const source = parseXmlEntry(xml);
const input = () => ({purchaseId,tpNF:'0',modelo:'55',recipientName:source.supplierName,recipientCnpj:source.supplierDocument,totalValue:100,items:source.items.map(i=>({...i,cfop:'1102'}))});
function fixture(options={}) {
  const calls=[];
  const repo={findOne:async()=>options.duplicate || null,manager:{getRepository:entity=>({
    findOne:async query=>{calls.push(query);return options.missing ? null : {id:purchaseId,tenantId,importedXml:xml,totalValue:100,status:'recebido',financialStatus:options.financialStatus || 'generated',paymentMethod:'boleto'};},
    find:async query=>{calls.push(query);return [{installmentNumber:1,dueDate:'2099-01-31',value:50,status:'pendente'},{installmentNumber:2,dueDate:'2099-02-28',value:50,status:'pendente'}];},
  })}};
  return {service:new FiscalSaleDataService(repo,{findOne:async()=>{throw Error('Entrada não pode buscar venda');}}),calls};
}
test('XML fornece endereço, número, bairro, IE, IBGE e telefone para emissão',()=>{
  assert.equal(source.supplierStreet,'Rua Teste');assert.equal(source.supplierNumber,'10');assert.equal(source.supplierNeighborhood,'Centro');assert.equal(source.supplierIE,'123456');assert.equal(source.supplierCityCode,'3106705');assert.equal(source.supplierPhone,'3133334444');
});
test('entrada sem venda usa compra do tenant e parcelas persistidas, ignorando valores adulterados',async()=>runInTenant(tenantId,async()=>{
  const f=fixture();const data=await f.service.validateSaleForInvoice(undefined,'nfe',{...input(),tPag:'17',paymentInstallments:[{value:100,dueDate:'2000-01-01'}],items:[{...input().items[0],quantity:999,unitPrice:1}]});
  assert.equal(data.tPag,'15');assert.equal(data.items[0].quantity,2);assert.equal(data.items[0].unitPrice,50);assert.equal(data.items[0].cfop,'1102');assert.equal(data.installments,2);assert.equal(data.paymentInstallments[1].dueDate,'2099-02-28');assert.ok(f.calls.every(q=>q.where.tenantId===tenantId));
}));
for(const [name,change,options] of [
  ['compra de outro tenant',{}, {missing:true}],['financeiro cancelado',{}, {financialStatus:'cancelled'}],['nota ativa duplicada',{}, {duplicate:{id:'invoice'}}],
  ['fornecedor adulterado',{recipientCnpj:'12345678000100'},{}],['total divergente',{totalValue:90},{}],['NFC-e de entrada',{modelo:'65'},{}],['itens ausentes',{items:[]},{}],['CFOP de saída',{items:source.items},{}],
]) test(`emissão bloqueia ${name}`,async()=>runInTenant(tenantId,async()=>assert.rejects(fixture(options).service.validateSaleForInvoice(undefined,'nfe',{...input(),...change}))));
test('NFS-e e NF-e de saída continuam exigindo venda',async()=>{
  for(const type of ['nfe','nfse']) await assert.rejects(fixture().service.validateSaleForInvoice(undefined,type,{tpNF:'1'}),/Venda obrigatória/);
  await assert.rejects(fixture().service.validateSaleForInvoice('sale','nfe',input()),/sem venda vinculada/);
});
test('prévia de entrada sem venda preserva itens e parcelas no DANFE',async()=>{
  const pdf=new DanfePdfService({}, {findOne:async()=>({nfeSeries:1})},{findOne:async()=>{throw Error('Não deve buscar venda');}},{});
  pdf.render=async(invoice,config,installments,preview)=>{
    assert.equal(preview,true);assert.equal(invoice.previewData.tpNF,'0');assert.equal(invoice.previewData.paymentInstallments.length,2);assert.equal(pdf.saleItems(invoice)[0].total,100);assert.equal(pdf.saleItems(invoice)[0].description,'Produto da entrada');return Buffer.from('PDF mock');
  };
  const result=await pdf.generatePreview(undefined,{...input(),paymentInstallments:[{value:50},{value:50}]});assert.equal(result.toString(),'PDF mock');
  await assert.rejects(pdf.generatePreview(undefined,{tpNF:'1',items:source.items}));
});
test('autorizar entrada já importada não duplica despesa nem dispara rotinas de venda',async()=>{
  let saves=0;
  const controller=Object.create(FiscalController.prototype);
  controller.validateSaleForInvoice=async()=>input();
  controller.invoiceRepo={create:x=>x,save:async x=>({...x,id:'entry-invoice'})};
  controller.nfeService={emit:async()=>({status:'autorizada',number:1})};
  controller.eventRepo={create:x=>x,save:async()=>{}};
  controller.movementRepo={create:x=>x,save:async()=>{saves++}};
  controller.completeNfTask=async()=>{throw Error('Não pode alterar venda');};
  const result=await controller.emitNfe({certId:'cert',saleData:input()},{user:{id:'user'}});
  assert.equal(result.status,'autorizada');assert.equal(saves,0);
});
test('XML de emissão preserva município, número, CFOP e vencimentos reais da entrada',()=>{
  const nfe=new NfeService(null,null,null,null);
  const data={...input(),recipientCMun:'3550308',recipientUf:'SP',recipientCity:'São Paulo',recipientAddress:'Rua Teste',recipientNumber:'10',tPag:'15',installments:2,paymentInstallments:[{number:1,dueDate:'2099-01-31',value:50},{number:2,dueDate:'2099-02-28',value:50}]};
  const result=nfe.buildNfeXml({cnpj:'12345678000100',ufCode:'31',cityCode:'3118601',environment:2},{number:1,series:1,recipientCnpj:data.recipientCnpj,totalValue:100},data,'1'.repeat(44),'55');
  for(const fragment of ['<tpNF>0</tpNF>','<idDest>2</idDest>','<cMun>3550308</cMun>','<nro>10</nro>','<CFOP>1102</CFOP>','<dVenc>2099-01-31</dVenc>','<dVenc>2099-02-28</dVenc>','<tPag>15</tPag>']) assert.ok(result.includes(fragment),fragment);
});
