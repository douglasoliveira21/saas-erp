import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';
import { Sale } from '../sales/entities/sale.entity';
import { Commission } from '../commissions/entities/commission.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Sale)
    private salesRepository: Repository<Sale>,
    @InjectRepository(Commission)
    private commissionsRepository: Repository<Commission>,
    private dataSource: DataSource,
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

  async getDre(year: number, month?: number): Promise<any> {
    const months = month ? [month] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const dreMonths: any[] = [];

    for (const m of months) {
      const startDate = `${year}-${String(m).padStart(2, '0')}-01`;
      const endDate = new Date(year, m, 0).toISOString().split('T')[0];
      const nextMonthStart = new Date(year, m, 1).toISOString();

      // Receita Bruta (vendas realizadas)
      const salesResult = await this.dataSource.query(`
        SELECT COALESCE(SUM(total_amount), 0) as receita_bruta
        FROM sales WHERE created_at >= $1 AND created_at < $2 AND status != 'cancelado'
      `, [startDate + 'T00:00:00', nextMonthStart]);

      const receitaBruta = Number(salesResult[0]?.receita_bruta || 0);

      // CMV - Custo das Mercadorias Vendidas
      const cmvResult = await this.dataSource.query(`
        SELECT COALESCE(SUM(si.cost_price * si.quantity), 0) as cmv
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE s.created_at >= $1 AND s.created_at < $2 AND s.status != 'cancelado'
      `, [startDate + 'T00:00:00', nextMonthStart]);
      const cmv = Number(cmvResult[0]?.cmv || 0);

      // Lucro Bruto
      const lucroBruto = receitaBruta - cmv;

      // Despesas Operacionais (from financial_movements type=despesa, excluding CMV categories)
      const despesasResult = await this.dataSource.query(`
        SELECT COALESCE(SUM(value), 0) as total
        FROM financial_movements
        WHERE type = 'despesa' AND date >= $1 AND date <= $2 AND is_forecast = false
          AND category NOT IN ('compra_mercadoria', 'depreciacao', 'amortizacao', 'impostos', 'imposto')
      `, [startDate, endDate]);
      const despesasFixas = Number(despesasResult[0]?.total || 0);

      // Comissões pagas no mês
      const comissoesResult = await this.dataSource.query(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM commissions
        WHERE status = 'paga' AND paid_at >= $1 AND paid_at < $2
      `, [startDate + 'T00:00:00', nextMonthStart]);
      const comissoes = Number(comissoesResult[0]?.total || 0);

      // Contas pagas a fornecedores
      const billsResult = await this.dataSource.query(`
        SELECT COALESCE(SUM(value), 0) as total
        FROM bills
        WHERE status = 'pago' AND paid_at >= $1 AND paid_at < $2
      `, [startDate + 'T00:00:00', nextMonthStart]);
      const contasPagas = Number(billsResult[0]?.total || 0);

      const totalDespesas = despesasFixas + comissoes + contasPagas;

      // EBITDA
      const ebitda = lucroBruto - totalDespesas;

      // Depreciação/Amortização
      const depreciacaoResult = await this.dataSource.query(`
        SELECT COALESCE(SUM(value), 0) as total
        FROM financial_movements
        WHERE type = 'despesa' AND date >= $1 AND date <= $2 AND is_forecast = false
          AND category IN ('depreciacao', 'amortizacao')
      `, [startDate, endDate]);
      const depreciacao = Number(depreciacaoResult[0]?.total || 0);

      // Lucro Operacional
      const lucroOperacional = ebitda - depreciacao;

      // Impostos
      const impostosResult = await this.dataSource.query(`
        SELECT COALESCE(SUM(value), 0) as total
        FROM financial_movements
        WHERE type = 'despesa' AND date >= $1 AND date <= $2 AND is_forecast = false
          AND category IN ('impostos', 'imposto')
      `, [startDate, endDate]);
      const impostos = Number(impostosResult[0]?.total || 0);

      // Lucro Líquido
      const lucroLiquido = lucroOperacional - impostos;

      dreMonths.push({
        month: m,
        year,
        label: new Date(year, m - 1).toLocaleDateString('pt-BR', { month: 'short' }),
        receitaBruta,
        cmv,
        lucroBruto,
        despesasOperacionais: totalDespesas,
        comissoes,
        contasPagas,
        despesasFixas,
        ebitda,
        depreciacao,
        lucroOperacional,
        impostos,
        lucroLiquido,
        margemBruta: receitaBruta > 0 ? (lucroBruto / receitaBruta * 100) : 0,
        margemEbitda: receitaBruta > 0 ? (ebitda / receitaBruta * 100) : 0,
        margemLiquida: receitaBruta > 0 ? (lucroLiquido / receitaBruta * 100) : 0,
      });
    }

    // Totals
    const totals = {
      receitaBruta: dreMonths.reduce((s, m) => s + m.receitaBruta, 0),
      cmv: dreMonths.reduce((s, m) => s + m.cmv, 0),
      lucroBruto: dreMonths.reduce((s, m) => s + m.lucroBruto, 0),
      despesasOperacionais: dreMonths.reduce((s, m) => s + m.despesasOperacionais, 0),
      ebitda: dreMonths.reduce((s, m) => s + m.ebitda, 0),
      depreciacao: dreMonths.reduce((s, m) => s + m.depreciacao, 0),
      lucroOperacional: dreMonths.reduce((s, m) => s + m.lucroOperacional, 0),
      impostos: dreMonths.reduce((s, m) => s + m.impostos, 0),
      lucroLiquido: dreMonths.reduce((s, m) => s + m.lucroLiquido, 0),
      margemBruta: 0,
      margemEbitda: 0,
      margemLiquida: 0,
    };
    if (totals.receitaBruta > 0) {
      totals.margemBruta = (totals.lucroBruto / totals.receitaBruta) * 100;
      totals.margemEbitda = (totals.ebitda / totals.receitaBruta) * 100;
      totals.margemLiquida = (totals.lucroLiquido / totals.receitaBruta) * 100;
    }

    return { year, months: dreMonths, totals };
  }
}
