import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Sale } from '../sales/entities/sale.entity';
import { Commission } from '../commissions/entities/commission.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Sale)
    private salesRepository: Repository<Sale>,
    @InjectRepository(Commission)
    private commissionsRepository: Repository<Commission>,
  ) {}

  async getSalesReport(startDate?: Date, endDate?: Date) {
    const where: any = {};
    if (startDate && endDate) {
      // endDate inclusive até fim do dia
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt = Between(startDate, end);
    }

    const sales = await this.salesRepository.find({
      where,
      relations: ['technician', 'customer', 'items'],
      order: { createdAt: 'DESC' },
    });

    const commissions = await this.commissionsRepository.find({ where });

    // KPIs
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((s, sale) => s + Number(sale.totalAmount), 0);
    const totalProfit = sales.reduce((s, sale) => s + Number(sale.netProfit), 0);
    const totalCommissions = commissions.reduce((s, c) => s + Number(c.amount), 0);

    // Por status
    const byStatusMap: Record<string, { count: number; total: number }> = {};
    sales.forEach(sale => {
      if (!byStatusMap[sale.status]) byStatusMap[sale.status] = { count: 0, total: 0 };
      byStatusMap[sale.status].count++;
      byStatusMap[sale.status].total += Number(sale.totalAmount);
    });
    const byStatus = Object.entries(byStatusMap).map(([status, data]) => ({ status, ...data }));

    // Por forma de pagamento
    const byPaymentMap: Record<string, { count: number; total: number }> = {};
    sales.forEach(sale => {
      const method = sale.paymentMethod as string;
      if (!byPaymentMap[method]) byPaymentMap[method] = { count: 0, total: 0 };
      byPaymentMap[method].count++;
      byPaymentMap[method].total += Number(sale.totalAmount);
    });
    const byPayment = Object.entries(byPaymentMap).map(([method, data]) => ({ method, ...data }));

    // Por técnico
    const byTechnicianMap: Record<string, { name: string; count: number; total: number; commission: number }> = {};
    sales.forEach(sale => {
      const id = sale.technicianId;
      const name = sale.technician?.name || 'Desconhecido';
      if (!byTechnicianMap[id]) byTechnicianMap[id] = { name, count: 0, total: 0, commission: 0 };
      byTechnicianMap[id].count++;
      byTechnicianMap[id].total += Number(sale.totalAmount);
      byTechnicianMap[id].commission += Number(sale.commissionAmount);
    });
    const byTechnician = Object.values(byTechnicianMap).sort((a, b) => b.total - a.total);

    // Mensal
    const monthlyMap: Record<string, { total: number; profit: number }> = {};
    sales.forEach(sale => {
      const d = new Date(sale.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      if (!monthlyMap[key]) monthlyMap[key] = { total: 0, profit: 0 };
      monthlyMap[key].total += Number(sale.totalAmount);
      monthlyMap[key].profit += Number(sale.netProfit);
    });
    const monthly = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => {
        const [year, month] = key.split('-');
        const d = new Date(parseInt(year), parseInt(month) - 1);
        return { month: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), ...data };
      });

    return { totalSales, totalRevenue, totalProfit, totalCommissions, byStatus, byPayment, byTechnician, monthly };
  }
}
