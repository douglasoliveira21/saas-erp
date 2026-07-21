import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Purchase } from './entities/purchase.entity';
import { FinancialMovement } from '../financial/entities/financial-movement.entity';
import { PurchaseItem } from './entities/purchase-item.entity';
import { PurchaseQuote } from './entities/purchase-quote.entity';
import { PurchaseAttachment } from './entities/purchase-attachment.entity';
import { Product } from '../products/entities/product.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { StockMovementType } from '../../common/enums/stock-movement-type.enum';
import { FinancialService } from '../financial/financial.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)
    private purchasesRepo: Repository<Purchase>,
    @InjectRepository(FinancialMovement)
    private movementRepo: Repository<FinancialMovement>,
    @InjectRepository(PurchaseItem)
    private itemRepo: Repository<PurchaseItem>,
    @InjectRepository(PurchaseQuote)
    private quoteRepo: Repository<PurchaseQuote>,
    @InjectRepository(PurchaseAttachment)
    private attachmentRepo: Repository<PurchaseAttachment>,
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    @InjectRepository(StockMovement)
    private stockMovementRepo: Repository<StockMovement>,
    private financialService: FinancialService,
    private auditService: AuditService,
  ) {}

  async create(dto: any): Promise<Purchase> {
    // Se tipo é entrada, já marca como recebido
    if (dto.type === 'entrada') {
      dto.status = 'recebido';
      dto.receivedAt = new Date();
    }
    const purchase = this.purchasesRepo.create(dto);
    const saved = await this.purchasesRepo.save(purchase);
    const result = Array.isArray(saved) ? saved[0] : saved;
    await this.saveItems(result.id, dto.itemsList || dto.items);

    // Se entrada de mercadoria, criar despesa no fluxo de caixa
    if (result.type === 'entrada' && Number(result.totalValue) > 0) {
      await this.movementRepo.save(
        this.movementRepo.create({
          type: 'despesa',
          category: 'compra_mercadoria',
          description: `Compra: ${result.description} - ${result.supplierName}`,
          value: Number(result.totalValue),
          date: new Date().toISOString().split('T')[0],
          referenceId: result.id,
          referenceType: 'purchase',
          paymentMethod: result.paymentMethod,
          isForecast: false,
          createdBy: dto.createdBy,
        }),
      );
    }

    return result;
  }

  async findAll(type?: string): Promise<Purchase[]> {
    const where: any = {};
    if (type) where.type = type;
    return this.purchasesRepo.find({
      where,
      relations: ['creator', 'approver', 'itemsList', 'quotes', 'attachments'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Purchase> {
    const purchase = await this.purchasesRepo.findOne({
      where: { id },
      relations: ['creator', 'approver', 'itemsList', 'quotes', 'attachments'],
    });
    if (!purchase) throw new NotFoundException('Compra não encontrada');
    return purchase;
  }

  async update(id: string, dto: any): Promise<Purchase> {
    const purchase = await this.findOne(id);
    Object.assign(purchase, dto);
    return this.purchasesRepo.save(purchase);
  }

  async approve(id: string, userId: string): Promise<Purchase> {
    const purchase = await this.findOne(id);
    if (purchase.status !== 'pendente') {
      throw new BadRequestException('Somente compras pendentes podem ser aprovadas');
    }
    purchase.status = 'aprovado';
    purchase.approvedBy = userId;
    purchase.approvedAt = new Date();
    const saved = await this.purchasesRepo.save(purchase);
    await this.auditService.safeCreate({
      userId,
      action: 'purchase.approved',
      entity: 'purchase',
      entityId: id,
      newData: { status: saved.status, totalValue: saved.totalValue },
    });
    return saved;
  }

  async receive(id: string, userId: string): Promise<Purchase> {
    const purchase = await this.findOne(id);
    if (!['aprovado', 'pendente'].includes(purchase.status)) {
      throw new BadRequestException('Compra precisa estar aprovada para receber mercadoria');
    }
    purchase.status = 'recebido';
    purchase.receivedAt = new Date();

    const saved = await this.purchasesRepo.save(purchase);

    // Criar movimentação financeira de despesa
    await this.movementRepo.save(
      this.movementRepo.create({
        type: 'despesa',
        category: 'compra_mercadoria',
        description: `Compra: ${purchase.description} - ${purchase.supplierName}`,
        value: Number(purchase.totalValue),
        date: new Date().toISOString().split('T')[0],
        referenceId: purchase.id,
        referenceType: 'purchase',
        paymentMethod: purchase.paymentMethod,
        isForecast: false,
        createdBy: userId,
      }),
    );

    return saved;
  }

  async createRequest(dto: any, userId: string) {
    return this.create({ ...dto, type: 'solicitacao', status: 'pendente', createdBy: userId });
  }

  async addQuote(purchaseId: string, dto: any, userId: string) {
    await this.findOne(purchaseId);
    const savedQuote = await this.quoteRepo.save(this.quoteRepo.create({
      ...dto,
      purchaseId,
      totalValue: Number(dto.totalValue || 0),
    }));
    const quote = Array.isArray(savedQuote) ? savedQuote[0] : savedQuote;
    await this.auditService.safeCreate({
      userId,
      action: 'purchase.quote_added',
      entity: 'purchase_quote',
      entityId: quote.id,
      newData: quote,
    });
    return quote;
  }

  async chooseQuote(purchaseId: string, quoteId: string, userId: string) {
    const purchase = await this.findOne(purchaseId);
    const quote = await this.quoteRepo.findOne({ where: { id: quoteId, purchaseId } });
    if (!quote) throw new NotFoundException('Cotação não encontrada');

    await this.quoteRepo.update({ purchaseId }, { status: 'rejeitada' });
    quote.status = 'escolhida';
    await this.quoteRepo.save(quote);

    purchase.selectedQuoteId = quote.id;
    purchase.supplierId = quote.supplierId;
    purchase.supplierName = quote.supplierName;
    purchase.supplierCnpj = quote.supplierCnpj;
    purchase.totalValue = Number(quote.totalValue);
    purchase.status = 'cotacao_aprovada';
    const saved = await this.purchasesRepo.save(purchase);
    await this.auditService.safeCreate({
      userId,
      action: 'purchase.quote_chosen',
      entity: 'purchase',
      entityId: purchaseId,
      newData: { quoteId, supplierName: quote.supplierName, totalValue: quote.totalValue },
    });
    return saved;
  }

  async createOrder(purchaseId: string, userId: string) {
    const purchase = await this.findOne(purchaseId);
    if (!['aprovado', 'cotacao_aprovada', 'pendente'].includes(purchase.status)) {
      throw new BadRequestException('Compra não pode virar ordem neste status');
    }
    purchase.type = 'ordem_compra';
    purchase.status = Number(purchase.totalValue) > Number(purchase.approvalLimit || 0) && !purchase.approvedBy
      ? 'pendente_aprovacao'
      : 'aprovado';
    if (purchase.status === 'aprovado' && !purchase.approvedBy) {
      purchase.approvedBy = userId;
      purchase.approvedAt = new Date();
    }
    const saved = await this.purchasesRepo.save(purchase);
    await this.auditService.safeCreate({
      userId,
      action: 'purchase.order_created',
      entity: 'purchase',
      entityId: purchaseId,
      newData: { status: saved.status, type: saved.type },
    });
    return saved;
  }

  async receivePartial(purchaseId: string, receipts: Array<{ itemId: string; quantity: number }>, userId: string) {
    const purchase = await this.findOne(purchaseId);
    if (!['aprovado', 'recebido_parcial'].includes(purchase.status)) {
      throw new BadRequestException('Compra precisa estar aprovada para receber mercadoria');
    }

    const items = await this.itemRepo.find({ where: { purchaseId } });
    for (const receipt of receipts || []) {
      const item = items.find((candidate) => candidate.id === receipt.itemId);
      if (!item) throw new NotFoundException('Item da compra não encontrado');
      const qty = Number(receipt.quantity || 0);
      if (qty <= 0 || Number(item.receivedQuantity) + qty > Number(item.quantity)) {
        throw new BadRequestException(`Quantidade inválida para ${item.description}`);
      }
      item.receivedQuantity = Number(item.receivedQuantity) + qty;
      await this.itemRepo.save(item);
      if (item.productId) {
        await this.applyPurchaseStock(item, qty, purchase, userId);
      }
    }

    const updatedItems = await this.itemRepo.find({ where: { purchaseId } });
    const allReceived = updatedItems.every((item) => Number(item.receivedQuantity) >= Number(item.quantity));
    purchase.status = allReceived ? 'recebido' : 'recebido_parcial';
    purchase.partiallyReceived = !allReceived;
    purchase.receivedAt = allReceived ? new Date() : purchase.receivedAt;
    const saved = await this.purchasesRepo.save(purchase);

    if (allReceived && Number(purchase.totalValue) > 0) {
      await this.financialService.createPayable({
        purchaseId: purchase.id,
        supplierId: purchase.supplierId,
        supplierName: purchase.supplierName,
        description: `Compra: ${purchase.description}`,
        totalValue: Number(purchase.totalValue),
        paymentMethod: purchase.paymentMethod,
        competenceDate: purchase.competenceDate || new Date().toISOString().split('T')[0],
        dueDate: purchase.dueDate,
        costCenterId: purchase.costCenterId,
        chartAccountId: purchase.chartAccountId,
      } as any, userId);
    }

    await this.auditService.safeCreate({
      userId,
      action: 'purchase.received_partial',
      entity: 'purchase',
      entityId: purchaseId,
      newData: { receipts, status: saved.status },
    });
    return saved;
  }

  async addAttachment(purchaseId: string, dto: any, userId: string) {
    await this.findOne(purchaseId);
    const savedAttachment = await this.attachmentRepo.save(this.attachmentRepo.create({
      ...dto,
      purchaseId,
      uploadedBy: userId,
    }));
    const attachment = Array.isArray(savedAttachment) ? savedAttachment[0] : savedAttachment;
    await this.auditService.safeCreate({
      userId,
      action: 'purchase.attachment_added',
      entity: 'purchase_attachment',
      entityId: attachment.id,
      newData: attachment,
    });
    return attachment;
  }

  async getAttachment(purchaseId: string, attachmentId: string) {
    await this.findOne(purchaseId);
    const attachment = await this.attachmentRepo.findOne({ where: { id: attachmentId, purchaseId } });
    if (!attachment) throw new NotFoundException('Anexo não encontrado');
    return attachment;
  }

  async returnPurchase(id: string, userId: string, reason: string): Promise<Purchase> {
    const purchase = await this.findOne(id);
    if (purchase.status !== 'recebido') {
      throw new BadRequestException('Somente compras recebidas podem ser devolvidas');
    }
    purchase.status = 'devolvido';
    purchase.observations = (purchase.observations || '') + `\nDevolução: ${reason}`;

    const saved = await this.purchasesRepo.save(purchase);

    // Criar estorno no fluxo de caixa
    await this.movementRepo.save(
      this.movementRepo.create({
        type: 'estorno',
        category: 'devolucao',
        description: `Devolução compra: ${purchase.description} - ${reason}`,
        value: Number(purchase.totalValue),
        date: new Date().toISOString().split('T')[0],
        referenceId: purchase.id,
        referenceType: 'purchase_return',
        isForecast: false,
        createdBy: userId,
      }),
    );

    return saved;
  }

  async cancel(id: string): Promise<Purchase> {
    const purchase = await this.findOne(id);
    if (['recebido', 'devolvido'].includes(purchase.status)) {
      throw new BadRequestException('Não é possível cancelar compra já recebida/devolvida');
    }
    purchase.status = 'cancelado';
    return this.purchasesRepo.save(purchase);
  }

  async remove(id: string): Promise<void> {
    const purchase = await this.findOne(id);
    await this.purchasesRepo.remove(purchase);
  }

  async getSummary(): Promise<any> {
    const all = await this.purchasesRepo.find();
    return {
      total: all.length,
      pendentes: all.filter(p => p.status === 'pendente').length,
      aprovadas: all.filter(p => p.status === 'aprovado').length,
      recebidas: all.filter(p => p.status === 'recebido').length,
      totalValue: all.filter(p => ['aprovado', 'recebido'].includes(p.status)).reduce((s, p) => s + Number(p.totalValue), 0),
    };
  }

  private async saveItems(purchaseId: string, rawItems: any) {
    const items = typeof rawItems === 'string' ? JSON.parse(rawItems || '[]') : rawItems;
    if (!Array.isArray(items) || items.length === 0) return;
    await this.itemRepo.save(items.map((item) => this.itemRepo.create({
      purchaseId,
      productId: item.productId || null,
      description: item.description || item.name || 'Item',
      quantity: Number(item.quantity || 0),
      receivedQuantity: Number(item.receivedQuantity || 0),
      unitPrice: Number(item.unitPrice || item.price || 0),
      totalValue: Number(item.totalValue || (Number(item.quantity || 0) * Number(item.unitPrice || item.price || 0))),
    })));
  }

  private async applyPurchaseStock(item: PurchaseItem, quantity: number, purchase: Purchase, userId: string) {
    const product = await this.productRepo.findOne({ where: { id: item.productId } });
    if (!product) return;
    const previousQuantity = Number(product.quantity);
    const newQuantity = previousQuantity + quantity;
    await this.productRepo.update(product.id, {
      quantity: newQuantity,
      purchasePrice: Number(item.unitPrice || product.purchasePrice),
    });
    await this.stockMovementRepo.save(this.stockMovementRepo.create({
      productId: product.id,
      type: StockMovementType.ENTRADA,
      quantity,
      previousQuantity,
      newQuantity,
      reason: `Recebimento compra #${purchase.id.substring(0, 8)}`,
      userId,
    }));
  }
}
