import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In, DataSource } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { Bill } from './entities/bill.entity';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
    @InjectRepository(Bill) private billRepo: Repository<Bill>,
    private dataSource: DataSource,
  ) {}

  // ==================== SUPPLIERS ====================
  async createSupplier(dto: any): Promise<Supplier> {
    const supplier = this.supplierRepo.create(dto as Partial<Supplier>);
    return await this.supplierRepo.save(supplier as any) as unknown as Supplier;
  }

  async findAllSuppliers(): Promise<Supplier[]> {
    return this.supplierRepo.find({ order: { name: 'ASC' } });
  }

  async findOneSupplier(id: string): Promise<Supplier> {
    const s = await this.supplierRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Fornecedor não encontrado');
    return s;
  }

  async updateSupplier(id: string, dto: any): Promise<Supplier> {
    const s = await this.findOneSupplier(id);
    Object.assign(s, dto);
    return this.supplierRepo.save(s);
  }

  async removeSupplier(id: string): Promise<void> {
    const s = await this.findOneSupplier(id);
    await this.supplierRepo.remove(s);
  }

  // ==================== BILLS ====================
  async createBill(dto: any, userId: string): Promise<Bill | Bill[]> {
    const installments = dto.installments || 1;

    if (installments > 1) {
      // Parcelamento
      const groupId = 'BILL-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      const baseValue = Math.floor((Number(dto.value) / installments) * 100) / 100;
      const bills: Bill[] = [];
      let totalDistributed = 0;

      for (let i = 1; i <= installments; i++) {
        const dueDate = new Date(dto.dueDate + 'T12:00:00');
        dueDate.setMonth(dueDate.getMonth() + (i - 1));
        const value = i === installments ? Number(dto.value) - totalDistributed : baseValue;
        totalDistributed += value;

        const bill = this.billRepo.create({
          ...dto,
          value: Number(value.toFixed(2)),
          dueDate: dueDate.toISOString().split('T')[0],
          installments,
          installmentNumber: i,
          recurringGroupId: groupId,
          createdBy: userId,
        });
        const saved = await this.billRepo.save(bill as any) as unknown as Bill;
        bills.push(saved);
      }
      return bills;
    }

    const bill = this.billRepo.create({ ...dto, createdBy: userId });
    return this.billRepo.save(bill);
  }

  async findAllBills(filters?: { status?: string; supplierId?: string; startDate?: string; endDate?: string; category?: string }): Promise<Bill[]> {
    const qb = this.billRepo.createQueryBuilder('bill')
      .leftJoinAndSelect('bill.supplier', 'supplier')
      .orderBy('bill.dueDate', 'ASC');

    if (filters?.status) qb.andWhere('bill.status = :status', { status: filters.status });
    if (filters?.supplierId) qb.andWhere('bill.supplierId = :supplierId', { supplierId: filters.supplierId });
    if (filters?.startDate) qb.andWhere('bill.dueDate >= :startDate', { startDate: filters.startDate });
    if (filters?.endDate) qb.andWhere('bill.dueDate <= :endDate', { endDate: filters.endDate });
    if (filters?.category) qb.andWhere('bill.category = :category', { category: filters.category });

    return qb.getMany();
  }

  async findOneBill(id: string): Promise<Bill> {
    const b = await this.billRepo.findOne({ where: { id }, relations: ['supplier'] });
    if (!b) throw new NotFoundException('Conta não encontrada');
    return b;
  }

  async updateBill(id: string, dto: any): Promise<Bill> {
    const b = await this.findOneBill(id);
    Object.assign(b, dto);
    return this.billRepo.save(b);
  }

  async payBill(id: string, paymentData?: { paymentMethod?: string; paidValue?: number }): Promise<Bill> {
    const bill = await this.findOneBill(id);
    if (bill.status === 'pago') throw new BadRequestException('Conta já está paga');

    const paidValue = paymentData?.paidValue || Number(bill.value);
    bill.paidValue = paidValue;
    bill.paidAt = new Date();
    bill.status = paidValue >= Number(bill.value) ? 'pago' : 'parcial';
    if (paymentData?.paymentMethod) bill.paymentMethod = paymentData.paymentMethod;

    return this.billRepo.save(bill);
  }

  async cancelBill(id: string): Promise<Bill> {
    const bill = await this.findOneBill(id);
    bill.status = 'cancelado';
    return this.billRepo.save(bill);
  }

  async removeBill(id: string): Promise<void> {
    const bill = await this.findOneBill(id);
    await this.billRepo.remove(bill);
  }

  // Alerts: bills due in next N days
  async getAlerts(days = 7): Promise<{ overdue: Bill[]; upcoming: Bill[] }> {
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const overdue = await this.billRepo.find({
      where: { status: In(['pendente', 'vencido']), dueDate: LessThanOrEqual(today) },
      relations: ['supplier'],
      order: { dueDate: 'ASC' },
    });

    // Mark as overdue
    for (const bill of overdue) {
      if (bill.status === 'pendente') {
        bill.status = 'vencido';
        await this.billRepo.save(bill);
      }
    }

    const upcoming = await this.billRepo.createQueryBuilder('bill')
      .leftJoinAndSelect('bill.supplier', 'supplier')
      .where('bill.status = :status', { status: 'pendente' })
      .andWhere('bill.dueDate > :today', { today })
      .andWhere('bill.dueDate <= :future', { future: futureDateStr })
      .orderBy('bill.dueDate', 'ASC')
      .getMany();

    return { overdue, upcoming };
  }

  // Report by supplier
  async getReportBySupplier(startDate?: string, endDate?: string): Promise<any[]> {
    let query = this.billRepo.createQueryBuilder('bill')
      .leftJoin('bill.supplier', 'supplier')
      .select('supplier.id', 'supplierId')
      .addSelect('supplier.name', 'supplierName')
      .addSelect('COUNT(bill.id)', 'totalBills')
      .addSelect('SUM(bill.value)', 'totalValue')
      .addSelect('SUM(CASE WHEN bill.status = \'pago\' THEN bill.value ELSE 0 END)', 'totalPaid')
      .addSelect('SUM(CASE WHEN bill.status IN (\'pendente\', \'vencido\') THEN bill.value ELSE 0 END)', 'totalPending')
      .groupBy('supplier.id')
      .addGroupBy('supplier.name')
      .orderBy('SUM(bill.value)', 'DESC');

    if (startDate) query = query.andWhere('bill.dueDate >= :startDate', { startDate });
    if (endDate) query = query.andWhere('bill.dueDate <= :endDate', { endDate });

    return query.getRawMany();
  }

  // Dashboard summary
  async getSummary(): Promise<any> {
    const today = new Date().toISOString().split('T')[0];
    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0);

    const all = await this.billRepo.find({ where: { status: In(['pendente', 'vencido', 'pago', 'parcial']) } });
    const overdue = all.filter(b => (b.status === 'pendente' || b.status === 'vencido') && b.dueDate <= today);
    const pending = all.filter(b => b.status === 'pendente' && b.dueDate > today);
    const paid = all.filter(b => b.status === 'pago');

    return {
      totalOverdue: overdue.reduce((s, b) => s + Number(b.value), 0),
      totalPending: pending.reduce((s, b) => s + Number(b.value), 0),
      totalPaid: paid.reduce((s, b) => s + Number(b.value), 0),
      qtdOverdue: overdue.length,
      qtdPending: pending.length,
      qtdPaid: paid.length,
    };
  }
}
