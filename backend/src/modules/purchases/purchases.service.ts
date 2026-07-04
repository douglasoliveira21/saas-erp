import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Purchase } from './entities/purchase.entity';
import { FinancialMovement } from '../financial/entities/financial-movement.entity';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(Purchase)
    private purchasesRepo: Repository<Purchase>,
    @InjectRepository(FinancialMovement)
    private movementRepo: Repository<FinancialMovement>,
  ) {}

  async create(dto: any): Promise<Purchase> {
    const purchase = this.purchasesRepo.create(dto);
    const saved = await this.purchasesRepo.save(purchase);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  async findAll(type?: string): Promise<Purchase[]> {
    const where: any = {};
    if (type) where.type = type;
    return this.purchasesRepo.find({
      where,
      relations: ['creator', 'approver'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Purchase> {
    const purchase = await this.purchasesRepo.findOne({
      where: { id },
      relations: ['creator', 'approver'],
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
    return this.purchasesRepo.save(purchase);
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
}
