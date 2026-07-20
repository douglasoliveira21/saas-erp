import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockMovement } from './entities/stock-movement.entity';
import { Product } from '../products/entities/product.entity';
import { FinancialService } from '../financial/financial.service';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(StockMovement)
    private stockMovementsRepository: Repository<StockMovement>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    private financialService: FinancialService,
  ) {}

  async create(createStockMovementDto: any): Promise<StockMovement> {
    const { productId, type, quantity, reason, userId } = createStockMovementDto;
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
    } else if (type === 'saida') {
      if (previousQuantity < normalizedQuantity) throw new BadRequestException('Estoque insuficiente');
      newQuantity = previousQuantity - normalizedQuantity;
    } else if (type === 'ajuste') {
      newQuantity = normalizedQuantity; // ajuste define o valor absoluto
    } else {
      newQuantity = previousQuantity - normalizedQuantity;
    }

    // Atualizar estoque do produto
    await this.productsRepository.update(productId, { quantity: newQuantity });

    const movement = this.stockMovementsRepository.create({
      productId,
      type,
      quantity: normalizedQuantity,
      previousQuantity,
      newQuantity,
      reason,
      userId,
    });

    const saved = await this.stockMovementsRepository.save(movement);

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

    return this.findOne((Array.isArray(saved) ? saved[0] : saved).id);
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

  async remove(id: string): Promise<{ message: string }> {
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
    return { message: 'Movimentação excluída e estoque revertido' };
  }
}
