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

  async importFromXml(products: any[]): Promise<{ imported: number; skipped: number; unchanged: number; items: Product[]; importedItems: Product[]; updatedItems: Product[]; unchangedItems: any[]; errors: any[] }> {
    let imported = 0;
    let skipped = 0;
    let unchanged = 0;
    const items: Product[] = [];
    const importedItems: Product[] = [];
    const updatedItems: Product[] = [];
    const unchangedItems: any[] = [];
    const errors: any[] = [];

    for (const p of products) {
      const name = String(p.name || p.xProd || '').trim();
      const code = String(p.code || p.cProd || '').trim();
      try {
        if (!name) throw new Error('Produto sem nome no XML');
        const existing = code ? await this.productsRepository.findOne({ where: { code } }) : null;
        if (existing) {
          const incomingPrice = Number(p.purchasePrice || p.unitPrice) || 0;
          const incomingQuantity = Number(p.quantity) || 0;
          const metadataChanged = (incomingPrice > 0 && Number(existing.purchasePrice) !== incomingPrice)
            || (!!p.ncm && existing.ncm !== p.ncm)
            || (!!p.cfop && existing.cfop !== p.cfop)
            || (!!p.cest && existing.cest !== p.cest)
            || (!!p.unit && existing.unit !== p.unit);
          if (!metadataChanged && incomingQuantity <= 0) {
            unchanged++;
            unchangedItems.push({ id: existing.id, name: existing.name, code: existing.code, quantity: existing.quantity });
            items.push(existing);
            continue;
          }
          // Produto já existente: soma a quantidade recebida e atualiza somente
          // os dados fiscais/preço efetivamente informados pelo XML.
          existing.quantity = (Number(existing.quantity) || 0) + Math.max(incomingQuantity, 0);
          if (incomingPrice > 0) existing.purchasePrice = incomingPrice;
          if (p.ncm) existing.ncm = p.ncm;
          if (p.cfop) existing.cfop = p.cfop;
          if (p.cest) existing.cest = p.cest;
          if (p.unit) existing.unit = p.unit;
          const saved = await this.productsRepository.save(existing);
          const result = Array.isArray(saved) ? saved[0] : saved;
          items.push(result);
          updatedItems.push(result);
          skipped++;
          continue;
        }

        const product = this.productsRepository.create({
          name,
          code: code || `IMP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          category: p.category || 'Importado',
          quantity: Number(p.quantity) || 1,
          purchasePrice: Number(p.purchasePrice || p.unitPrice) || 0,
          salePrice: 0,
          taxPercentage: 0,
          supplier: p.supplier || 'Importação XML',
          minStock: 1,
          ncm: p.ncm || null,
          cfop: p.cfop || null,
          cest: p.cest || null,
          unit: p.unit || 'UN',
          description: p.description || null,
          active: true,
        });
        const saved = await this.productsRepository.save(product);
        const result = Array.isArray(saved) ? saved[0] : saved;
        items.push(result);
        importedItems.push(result);
        imported++;
      } catch (error: any) {
        errors.push({ name: name || 'Produto sem nome', code: code || null, message: error?.message || 'Erro ao importar produto' });
      }
    }

    return { imported, skipped, unchanged, items, importedItems, updatedItems, unchangedItems, errors };
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
    await this.productsRepository.softRemove(product);
  }

  async findLowStock(): Promise<Product[]> {
    return this.productsRepository
      .createQueryBuilder('product')
      .where('product.quantity <= product.minStock')
      .getMany();
  }
}
