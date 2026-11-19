import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { todayInBrasilia } from '../../common/date';
import { Tenant } from '../platform/entities/tenant.entity';
import { ProductsService } from '../products/products.service';
import { Purchase } from './entities/purchase.entity';
import { PurchaseItem } from './entities/purchase-item.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { Bill } from '../suppliers/entities/bill.entity';
import { FinancialMovement } from '../financial/entities/financial-movement.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { StockMovementType } from '../../common/enums/stock-movement-type.enum';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { parseXmlEntry, validateXmlEntryPayments } from './xml-entry';

@Injectable()
export class XmlEntryService {
  constructor(private readonly source: DataSource, private readonly context: TenantContextService, private readonly products: ProductsService) {}

  async preview(xml: unknown) {
    const entry = parseXmlEntry(xml);
    const tenant = await this.source.getRepository(Tenant).findOne({ where: { id: this.context.requireTenantId() } });
    const document = String(tenant?.document || '').replace(/\D/g,'');
    if (document && entry.recipientDocument !== document) throw new BadRequestException('O destinatário desta NF-e não corresponde ao documento cadastrado para esta empresa.');
    const tenantId = this.context.requireTenantId();
    const purchase = await this.source.getRepository(Purchase).findOne({where:{tenantId,xmlAccessKey:entry.accessKey}});
    if (purchase) {
      if (purchase.status !== 'recebido' || !['generated','partially_paid','paid'].includes(purchase.financialStatus)) throw new BadRequestException('Este XML já foi importado, mas a compra ou o financeiro não está ativo. Confira a compra antes de emitir.');
      const bills = await this.source.getRepository(Bill).find({where:{tenantId,purchaseId:purchase.id,type:'pagar'},order:{installmentNumber:'ASC'}});
      return {...entry,purchaseId:purchase.id,paymentMethod:purchase.paymentMethod,
        installments:bills.filter(row=>row.status !== 'cancelado').map(row=>({number:row.installmentNumber,dueDate:row.dueDate,value:Number(row.value)}))};
    }
    return entry;
  }

  async import(dto: any, userId: string) {
    const entry = await this.preview(dto?.xml);
    const tenantId = this.context.requireTenantId();
    if (!['product','expense'].includes(dto.destination)) throw new BadRequestException('Selecione o destino dos itens da nota.');
    const installments = validateXmlEntryPayments(entry.totalValue, dto.paymentMethod, dto.installments);
    if (dto.destination === 'product' && entry.items.some(item => !Number.isInteger(item.quantity))) throw new BadRequestException('O estoque trabalha com unidades inteiras. Converta as quantidades fracionadas antes de importar para estoque ou selecione somente despesa.');

    return this.source.transaction(async manager => {
      // Serializa importações do tenant, inclusive quando a mesma nota é enviada novamente.
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['xml-entry:' + tenantId]);
      const purchaseRepo = manager.getRepository(Purchase);
      const existing = await purchaseRepo.findOne({ where: { tenantId, xmlAccessKey: entry.accessKey } });
      if (existing) throw new ConflictException(`A NF-e ${entry.invoiceNumber} de ${entry.supplierName} já foi importada. O estoque e as contas não foram lançados novamente. Consulte a compra ${existing.id}.`);

      const supplierRepo = manager.getRepository(Supplier);
      let supplier = await supplierRepo.createQueryBuilder('supplier').where('supplier.tenantId = :tenantId', {tenantId})
        .andWhere("regexp_replace(supplier.cpf_cnpj, '[^0-9]', '', 'g') = :document", {document:entry.supplierDocument}).getOne();
      if (!supplier) supplier = await supplierRepo.save(supplierRepo.create({ tenantId, name:entry.supplierName, cpfCnpj:entry.supplierDocument,
        address:entry.supplierAddress, city:entry.supplierCity, uf:entry.supplierUf, cep:entry.supplierCep, active:true }));
      const dueDate = [...installments].sort((a,b) => a.dueDate.localeCompare(b.dueDate))[0].dueDate;
      const purchase = await purchaseRepo.save(purchaseRepo.create({ tenantId, type:'entrada', status:'recebido',
        description:`NF-e ${entry.invoiceNumber} - ${entry.supplierName}`.slice(0,255), supplierId:supplier.id,
        supplierName:entry.supplierName, supplierCnpj:entry.supplierDocument, invoiceNumber:entry.invoiceNumber,
        xmlAccessKey:entry.accessKey, importedXml:dto.xml, totalValue:entry.totalValue, paymentMethod:dto.paymentMethod,
        competenceDate:entry.emissionDate, dueDate, receivedAt:new Date(), createdBy:userId,
        financialStatus:'generated', financialTotal:entry.totalValue, financialGeneratedAt:new Date(), financialGeneratedBy:userId,
        items:JSON.stringify(entry.items), observations:'Importação de XML: ' + (dto.destination === 'product' ? 'entrada em estoque' : 'somente despesa') }));

      const summary = dto.destination === 'product' ? await this.products.importFromXml(entry.items, manager)
        : {imported:0,skipped:0,unchanged:0,items:[],importedItems:[],updatedItems:[],unchangedItems:[],errors:[]};
      for (let index=0; index<entry.items.length; index++) {
        const item = entry.items[index], product = summary.items[index];
        await manager.getRepository(PurchaseItem).save(manager.getRepository(PurchaseItem).create({ tenantId, purchaseId:purchase.id,
          productId:product?.id || null, description:item.name, quantity:item.quantity, receivedQuantity:item.quantity,
          unitPrice:item.unitPrice, totalValue:Math.round(item.unitPrice*item.quantity*100)/100 }));
        if (product) await manager.getRepository(StockMovement).save(manager.getRepository(StockMovement).create({ tenantId,
          productId:product.id, type:StockMovementType.ENTRADA, quantity:item.quantity,
          previousQuantity:Number(product.quantity)-item.quantity, newQuantity:Number(product.quantity), unitCost:item.unitPrice,
          reason:`Entrada NF-e ${entry.invoiceNumber} - ${entry.supplierName}`, userId }));
      }

      const bills: any[] = [];
      for (const row of installments) {
        const description = `NF-e ${entry.invoiceNumber} - ${entry.supplierName} (${row.number}/${installments.length})`.slice(0,255);
        const billRepo = manager.getRepository(Bill);
        const bill = await billRepo.save(billRepo.create({ tenantId, type:'pagar', supplierId:supplier.id, description, value:row.value,
          dueDate:row.dueDate, status:row.dueDate < todayInBrasilia() ? 'vencido' : 'pendente', category:'compra_mercadoria',
          paymentMethod:dto.paymentMethod, installments:installments.length, installmentNumber:row.number, purchaseId:purchase.id,
          billGroupId:'XML-' + purchase.id, documentNumber:entry.invoiceNumber, createdBy:userId }));
        const movementRepo = manager.getRepository(FinancialMovement);
        await movementRepo.save(movementRepo.create({ tenantId, type:'despesa', category:'compra_mercadoria', description,
          value:row.value, date:row.dueDate, dueDate:row.dueDate, competenceDate:entry.emissionDate, billId:bill.id,
          referenceId:purchase.id, referenceType:'purchase', paymentMethod:dto.paymentMethod, isForecast:true,
          idempotencyKey:`xml-purchase:${purchase.id}:${row.number}`, createdBy:userId }));
        bills.push({id:bill.id,number:row.number,dueDate:row.dueDate,value:row.value,status:bill.status});
      }
      await manager.getRepository(AuditLog).save(manager.getRepository(AuditLog).create({tenantId,userId,action:'purchase.xml_imported',entity:'purchase',entityId:purchase.id,
        newData:{accessKey:entry.accessKey,destination:dto.destination,paymentMethod:dto.paymentMethod,totalValue:entry.totalValue,installments:bills}}));
      return {...summary, total:entry.items.length, destination:dto.destination, purchaseId:purchase.id, invoiceNumber:entry.invoiceNumber,
        supplierName:entry.supplierName, totalValue:entry.totalValue, paymentMethod:dto.paymentMethod, installments:bills};
    });
  }
}
