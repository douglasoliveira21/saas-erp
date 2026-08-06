import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sale } from '../sales/entities/sale.entity';
import { Commission } from '../commissions/entities/commission.entity';
import { Product } from '../products/entities/product.entity';
import { Route } from '../routes/entities/route.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Sale)
    private salesRepository: Repository<Sale>,
    @InjectRepository(Commission)
    private commissionsRepository: Repository<Commission>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Route)
    private routesRepository: Repository<Route>,
  ) {}

  async getDashboardData() {
    const totalSales = await this.salesRepository.count();

    // Current month boundaries (Brasilia UTC-3)
    const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const monthStart = `${currentMonth}-01`;

    // Faturamento e lucro = apenas vendas PAGAS ou FINALIZADAS
    const paidData = await this.salesRepository
      .createQueryBuilder('sale')
      .select('SUM(sale.total_amount)', 'totalRevenue')
      .addSelect('SUM(sale.net_profit)', 'totalProfit')
      .where('sale.status IN (:...statuses)', { statuses: ['pago', 'finalizado'] })
      .getRawOne();

    // A receber = vendas pendentes, nf_emitida, boleto_emitido
    const receivableData = await this.salesRepository
      .createQueryBuilder('sale')
      .select('SUM(sale.total_amount)', 'totalReceivable')
      .where('sale.status IN (:...statuses)', { statuses: ['pendente', 'nf_emitida', 'boleto_emitido'] })
      .getRawOne();

    const pendingCommissions = await this.commissionsRepository
      .createQueryBuilder('commission')
      .select('SUM(commission.amount)', 'total')
      .where('commission.status = :status', { status: 'pendente' })
      .getRawOne();

    // Commissions paid this month
    const paidCommissionsMonth = await this.commissionsRepository
      .createQueryBuilder('commission')
      .select('SUM(commission.amount)', 'total')
      .where('commission.status = :status', { status: 'paga' })
      .andWhere('(commission.reference_month = :month OR (commission.reference_month IS NULL AND commission.created_at >= :start))',
        { month: currentMonth, start: monthStart })
      .getRawOne();

    const lowStockProducts = await this.productsRepository
      .createQueryBuilder('product')
      .where('product.quantity <= product.min_stock')
      .getCount();

    return {
      totalSales,
      totalRevenue: parseFloat(paidData?.totalRevenue || '0'),
      totalProfit: parseFloat(paidData?.totalProfit || '0'),
      totalReceivable: parseFloat(receivableData?.totalReceivable || '0'),
      pendingCommissions: parseFloat(pendingCommissions?.total || '0'),
      paidCommissionsMonth: parseFloat(paidCommissionsMonth?.total || '0'),
      currentMonth,
      lowStockProducts,
    };
  }

  async getTechniciansSummary(month?: string) {
    // Use provided month or current month (Brasilia UTC-3)
    const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const currentMonth = month || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const monthStart = `${currentMonth}-01`;

    // Comissões pendentes/aprovadas do mês por técnico
    const commissions = await this.commissionsRepository
      .createQueryBuilder('commission')
      .leftJoinAndSelect('commission.technician', 'technician')
      .where('commission.status IN (:...statuses)', { statuses: ['pendente', 'aprovada'] })
      .andWhere('(commission.reference_month = :month OR (commission.reference_month IS NULL AND commission.created_at >= :start))',
        { month: currentMonth, start: monthStart })
      .getMany();

    // Rotas pendentes/aprovadas do mês por técnico
    const routes = await this.routesRepository
      .createQueryBuilder('route')
      .leftJoinAndSelect('route.technician', 'technician')
      .where('route.status IN (:...statuses)', { statuses: ['pendente', 'aprovado'] })
      .andWhere('route.route_date >= :start', { start: monthStart })
      .getMany();

    // Agrupar por técnico
    const techMap: Record<string, {
      id: string;
      name: string;
      commissions: { id: string; description: string; amount: number; saleId: string }[];
      routes: { id: string; description: string; km: number; totalValue: number; routeDate: string }[];
      totalCommissions: number;
      totalRoutes: number;
      total: number;
    }> = {};

    for (const c of commissions) {
      const id = c.technicianId;
      if (!techMap[id]) {
        techMap[id] = {
          id,
          name: c.technician?.name || 'Desconhecido',
          commissions: [],
          routes: [],
          totalCommissions: 0,
          totalRoutes: 0,
          total: 0,
        };
      }
      techMap[id].commissions.push({
        id: c.id,
        description: c.description || `Comissão de venda`,
        amount: Number(c.amount),
        saleId: c.saleId,
      });
      techMap[id].totalCommissions += Number(c.amount);
    }

    for (const r of routes) {
      const id = r.technicianId;
      if (!techMap[id]) {
        techMap[id] = {
          id,
          name: r.technician?.name || 'Desconhecido',
          commissions: [],
          routes: [],
          totalCommissions: 0,
          totalRoutes: 0,
          total: 0,
        };
      }
      techMap[id].routes.push({
        id: r.id,
        description: r.description,
        km: Number(r.km),
        totalValue: Number(r.totalValue),
        routeDate: r.routeDate,
      });
      techMap[id].totalRoutes += Number(r.totalValue);
    }

    // Calcular total geral por técnico
    for (const t of Object.values(techMap)) {
      t.total = t.totalCommissions + t.totalRoutes;
    }

    return Object.values(techMap).sort((a, b) => b.total - a.total);
  }
}
