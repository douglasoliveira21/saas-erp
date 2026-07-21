import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockMovement } from './entities/stock-movement.entity';
import { Product } from '../products/entities/product.entity';
import { FinancialService } from '../financial/financial.service';
import { AuditService } from '../audit/audit.service';
import { StockInventory } from './entities/stock-inventory.entity';

@Injectable()
export class StockService implements OnModuleInit {
  constructor(
    @InjectRepository(StockMovement)
    private stockMovementsRepository: Repository<StockMovement>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(StockInventory)
    private inventoryRepository: Repository<StockInventory>,
    private financialService: FinancialService,
    private auditService: AuditService,
  ) {}

  onModuleInit() {
    if (process.env.STOCK_JOBS_ENABLED === 'false') return;
    const minutes = Math.max(Number(process.env.STOCK_JOBS_INTERVAL_MINUTES || 60), 15);
    setTimeout(() => this.runStockJobs('startup'), 30000);
    setInterval(() => this.runStockJobs('interval'), minutes * 60 * 1000);
  }

  async runStockJobs(source = 'manual') {
    const lowStock = await this.getLowStock();
    if (lowStock.length > 0) {
      await this.auditService.safeCreate({
        userId: null,
        action: 'stock.low_stock_detected',
        entity: 'product',
        entityId: null,
        newData: {
          source,
          count: lowStock.length,
          products: lowStock.map((product) => ({
            id: product.id,
            code: product.code,
            name: product.name,
            quantity: product.quantity,
            minStock: product.minStock,
          })),
        },
      });
    }
    return { lowStock: lowStock.length };
  }

  async create(createStockMovementDto: any): Promise<StockMovement> {
    const { productId, type, quantity, reason, userId, unitCost, lotNumber, serialNumber } = createStockMovementDto;
    const normalizedQuantity = Number(quantity);

    if (!['entrada', 'saida', 'ajuste'].includes(type)) {
      throw new BadRequestException('Tipo de movimentação inválido. Venda e estorno são gerados automaticamente.');
    }
    if (!Number.isInteger(normalizedQuantity) || normalizedQuantity < 0 || (type !== 'ajuste' && normalizedQuantity === 0)) {
      throw new BadRequestException('A quantidade deve ser um número inteiro válido');
    }

    const product = await this.productsRepository.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Produto não encontrado');

    const previousQuantity = product.quantity;
    let newQuantity: number;

    if (type === 'entrada') {
      newQuantity = previousQuantity + normalizedQuantity;
      if (unitCost && normalizedQuantity > 0) {
        const previousValue = Number(product.averageCost || product.purchasePrice || 0) * previousQuantity;
        const incomingValue = Number(unitCost) * normalizedQuantity;
        const averageCost = newQuantity > 0 ? (previousValue + incomingValue) / newQuantity : Number(unitCost);
        product.averageCost = Number(averageCost.toFixed(4));
        product.purchasePrice = Number(unitCost);
      }
    } else if (type === 'saida') {
      if (previousQuantity < normalizedQuantity) throw new BadRequestException('Estoque insuficiente');
      newQuantity = previousQuantity - normalizedQuantity;
    } else if (type === 'ajuste') {
      newQuantity = normalizedQuantity; // ajuste define o valor absoluto
    } else {
      newQuantity = previousQuantity - normalizedQuantity;
    }

    // Atualizar estoque do produto
    await this.productsRepository.update(productId, {
      quantity: newQuantity,
      averageCost: product.averageCost,
      purchasePrice: product.purchasePrice,
    });

    const movement = this.stockMovementsRepository.create({
      productId,
      type,
      quantity: normalizedQuantity,
      previousQuantity,
      newQuantity,
      reason,
      unitCost: unitCost ? Number(unitCost) : null,
      lotNumber: lotNumber || null,
      serialNumber: serialNumber || null,
      userId,
    });

    const saved = await this.stockMovementsRepository.save(movement);
    const savedMovement = Array.isArray(saved) ? saved[0] : saved;
    await this.auditService.safeCreate({
      userId,
      action: 'stock.movement_created',
      entity: 'stock_movement',
      entityId: savedMovement.id,
      oldData: { productId, quantity: previousQuantity },
      newData: {
        productId,
        type,
        quantity: normalizedQuantity,
        previousQuantity,
        newQuantity,
        reason,
        unitCost,
        lotNumber,
        serialNumber,
      },
    });

    // Registrar despesa no fluxo de caixa para entradas de mercadoria
    if (type === 'entrada') {
      const totalCost = Number(product.purchasePrice || 0) * normalizedQuantity;
      if (totalCost > 0) {
        try {
          const now = new Date();
          const dateStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
          await this.financialService.createMovement({
            type: 'despesa',
            category: 'compra_mercadoria',
            description: `Compra: ${product.name} (${normalizedQuantity}x R$${Number(product.purchasePrice).toFixed(2)})`,
            value: totalCost,
            date: dateStr,
            paymentMethod: 'outros',
            isForecast: false,
            createdBy: userId,
          } as any);
        } catch {}
      }
    }

    return this.findOne(savedMovement.id);
  }

  async findAll(): Promise<StockMovement[]> {
    return this.stockMovementsRepository.find({
      relations: ['product', 'user'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<StockMovement> {
    const movement = await this.stockMovementsRepository.findOne({
      where: { id },
      relations: ['product', 'user'],
    });
    if (!movement) throw new NotFoundException('Movimentação não encontrada');
    return movement;
  }

  async remove(id: string, userId?: string): Promise<{ message: string }> {
    const movement = await this.findOne(id);

    if (movement.saleId || movement.type === 'venda' || movement.type === 'estorno') {
      throw new BadRequestException('Movimentações de venda e estorno não podem ser excluídas manualmente');
    }

    // Reverter o estoque
    const product = await this.productsRepository.findOne({ where: { id: movement.productId } });
    if (product) {
      let revertedQty = product.quantity;
      if (movement.type === 'entrada') {
        revertedQty = product.quantity - movement.quantity;
      } else if (movement.type === 'saida') {
        revertedQty = product.quantity + movement.quantity;
      }
      await this.productsRepository.update(product.id, { quantity: Math.max(0, revertedQty) });
    }

    await this.stockMovementsRepository.remove(movement);
    await this.auditService.safeCreate({
      userId: userId || movement.userId,
      action: 'stock.movement_deleted',
      entity: 'stock_movement',
      entityId: id,
      oldData: movement,
      newData: {
        deleted: true,
        stockReverted: true,
      },
    });
    return { message: 'Movimentação excluída e estoque revertido' };
  }

  async getLowStock() {
    return this.productsRepository
      .createQueryBuilder('product')
      .where('product.active = :active', { active: true })
      .andWhere('product.quantity <= product.minStock')
      .orderBy('product.name', 'ASC')
      .getMany();
  }

  async getKardex(productId: string) {
    const product = await this.productsRepository.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Produto não encontrado');
    const movements = await this.stockMovementsRepository.find({
      where: { productId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
    return {
      product,
      currentQuantity: product.quantity,
      reservedQuantity: product.reservedQuantity || 0,
      availableQuantity: Number(product.quantity) - Number(product.reservedQuantity || 0),
      movements,
    };
  }

  async inventoryAdjust(productId: string, countedQuantity: number, justification: string, userId: string) {
    if (!justification) throw new BadRequestException('Justificativa é obrigatória para inventário');
    const product = await this.productsRepository.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Produto não encontrado');
    const systemQuantity = Number(product.quantity);
    const difference = Number(countedQuantity) - systemQuantity;
    const inventory = await this.inventoryRepository.save(this.inventoryRepository.create({
      productId,
      countedQuantity: Number(countedQuantity),
      systemQuantity,
      difference,
      justification,
      createdBy: userId,
    }));
    await this.create({
      productId,
      type: 'ajuste',
      quantity: Number(countedQuantity),
      reason: `Inventário #${inventory.id}: ${justification}`,
      userId,
    });
    await this.auditService.safeCreate({
      userId,
      action: 'stock.inventory_adjusted',
      entity: 'stock_inventory',
      entityId: inventory.id,
      oldData: { quantity: systemQuantity },
      newData: inventory,
    });
    return inventory;
  }

  async reserve(productId: string, quantity: number, userId: string, reason?: string) {
    const product = await this.productsRepository.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Produto não encontrado');
    const available = Number(product.quantity) - Number(product.reservedQuantity || 0);
    if (Number(quantity) > available) throw new BadRequestException('Quantidade indisponível para reserva');
    product.reservedQuantity = Number(product.reservedQuantity || 0) + Number(quantity);
    const saved = await this.productsRepository.save(product);
    await this.auditService.safeCreate({
      userId,
      action: 'stock.reserved',
      entity: 'product',
      entityId: productId,
      newData: { quantity, reservedQuantity: saved.reservedQuantity, reason },
    });
    return saved;
  }

  async releaseReservation(productId: string, quantity: number, userId: string, reason?: string) {
    const product = await this.productsRepository.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Produto não encontrado');
    product.reservedQuantity = Math.max(0, Number(product.reservedQuantity || 0) - Number(quantity));
    const saved = await this.productsRepository.save(product);
    await this.auditService.safeCreate({
      userId,
      action: 'stock.reservation_released',
      entity: 'product',
      entityId: productId,
      newData: { quantity, reservedQuantity: saved.reservedQuantity, reason },
    });
    return saved;
  }
}
