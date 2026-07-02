import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { FinancialService } from '../financial/financial.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    private financialService: FinancialService,
  ) {}

  async create(createProductDto: any): Promise<Product> {
    const product = this.productsRepository.create(createProductDto);
    const saved = await this.productsRepository.save(product);
    const result = Array.isArray(saved) ? saved[0] : saved;

    // Registrar custo de compra como despesa no financeiro
    const qty = Number(result.quantity) || 0;
    const purchasePrice = Number(result.purchasePrice) || 0;
    const totalCost = qty * purchasePrice;
    if (totalCost > 0) {
      try {
        const now = new Date();
        const dateStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
        await this.financialService.createMovement({
          type: 'despesa',
          category: 'compra_mercadoria',
          description: `Cadastro produto: ${result.name} (${qty}x R$${purchasePrice.toFixed(2)})`,
          value: totalCost,
          date: dateStr,
          paymentMethod: 'outros',
          isForecast: false,
        } as any);
      } catch {}
    }

    return result;
  }

  async findAll(): Promise<Product[]> {
    return this.productsRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({ where: { id } });
    
    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }
    
    return product;
  }

  async update(id: string, updateProductDto: any): Promise<Product> {
    const product = await this.findOne(id);
    Object.assign(product, updateProductDto);
    return this.productsRepository.save(product);
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.productsRepository.remove(product);
  }

  async findLowStock(): Promise<Product[]> {
    return this.productsRepository
      .createQueryBuilder('product')
      .where('product.quantity <= product.minStock')
      .getMany();
  }
}
