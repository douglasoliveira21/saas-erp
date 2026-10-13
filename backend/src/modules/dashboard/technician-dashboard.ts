// Painel do técnico - em arquivo próprio para o DashboardService não crescer ainda mais. Recebe os
// repositórios que o serviço já tem.
import { Repository } from 'typeorm';
import { Sale } from '../sales/entities/sale.entity';
import { Commission } from '../commissions/entities/commission.entity';
import { Route } from '../routes/entities/route.entity';
import { ServiceOrder } from '../service-orders/entities/service-order.entity';
import { ServiceOrderStatus } from '../service-orders/entities/service-order-status.entity';

export interface TechnicianDashboard {
  month: string;
  serviceOrders: {
    open: number;
    stale: number;
    staleDays: number;
    completedMonth: number;
    avgHoursToComplete: number;
    active: Array<{
      id: string;
      number: number;
      customerName: string;
      serviceType: string;
      equipment: string;
      statusKey: string;
      statusLabel: string;
      statusColor: string;
      openedAt: Date;
      daysOpen: number;
    }>;
  };
  routes: {
    count: number;
    km: number;
    totalValue: number;
    byStatus: Record<string, { count: number; value: number }>;
    recent: Array<{ id: string; date: string; description: string; km: number; totalValue: number; status: string }>;
  };
  commissions: { pending: number; paidMonth: number };
  sales: { count: number; total: number; paid: number };
}

const DAY_MS = 24 * 3600000;
const STALE_DAYS = 7;

/** Mês de referência (AAAA-MM) e limites [início, próximo mês) no horário de Brasília (UTC-3). */
export function resolveMonth(month?: string) {
  const nowBr = new Date(Date.now() - 3 * 3600000);
  const current = `${nowBr.getUTCFullYear()}-${String(nowBr.getUTCMonth() + 1).padStart(2, '0')}`;
  const ref = /^\d{4}-(0[1-9]|1[0-2])$/.test(month || '') ? (month as string) : current;
  const [year, monthNum] = ref.split('-').map(Number);
  const monthStart = `${ref}-01`;
  const nextMonthStart = monthNum === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNum + 1).padStart(2, '0')}-01`;
  return { ref, monthStart, nextMonthStart };
}

export async function buildTechnicianDashboard(
  technicianId: string,
  month: string | undefined,
  repos: { sales: Repository<Sale>; commissions: Repository<Commission>; routes: Repository<Route> },
): Promise<TechnicianDashboard> {
  const { ref, monthStart, nextMonthStart } = resolveMonth(month);
  const manager = repos.sales.manager;
  const orderRepo = manager.getRepository(ServiceOrder);
  const statuses = await manager.getRepository(ServiceOrderStatus).find();
  const statusByKey = new Map(statuses.map((s) => [s.key, s]));
  const finalKeys = statuses.filter((s) => s.isFinal).map((s) => s.key);
  const mine = () => orderRepo.createQueryBuilder('o').where('o.technicianId = :technicianId', { technicianId });

  const openQb = mine();
  if (finalKeys.length) openQb.andWhere('o.statusKey NOT IN (:...finalKeys)', { finalKeys });
  const openOrders = await openQb.leftJoinAndSelect('o.customer', 'customer').orderBy('o.openedAt', 'ASC').getMany();

  const completedMonth = await mine()
    .andWhere('o.completedAt >= :monthStart AND o.completedAt < :nextMonthStart', { monthStart, nextMonthStart })
    .getMany();
  const hours = completedMonth
    .filter((o) => o.startedAt && o.completedAt)
    .map((o) => (new Date(o.completedAt).getTime() - new Date(o.startedAt).getTime()) / 3600000);
  const avgHours = hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : 0;
  const nowMs = Date.now();

  const routeRows = await repos.routes
    .createQueryBuilder('r')
    .where('r.technicianId = :technicianId', { technicianId })
    .andWhere('r.routeDate >= :monthStart AND r.routeDate < :nextMonthStart', { monthStart, nextMonthStart })
    .orderBy('r.routeDate', 'DESC')
    .getMany();
  const byStatus: Record<string, { count: number; value: number }> = {};
  for (const r of routeRows) {
    byStatus[r.status] = byStatus[r.status] || { count: 0, value: 0 };
    byStatus[r.status].count += 1;
    byStatus[r.status].value += Number(r.totalValue || 0);
  }

  const pending = await repos.commissions
    .createQueryBuilder('c')
    .select('COALESCE(SUM(c.amount), 0)', 'total')
    .where('c.technicianId = :technicianId', { technicianId })
    .andWhere('c.status = :status', { status: 'pendente' })
    .getRawOne();
  const paid = await repos.commissions
    .createQueryBuilder('c')
    .select('COALESCE(SUM(c.amount), 0)', 'total')
    .where('c.technicianId = :technicianId', { technicianId })
    .andWhere('c.status = :status', { status: 'paga' })
    .andWhere('(c.reference_month = :ref OR (c.reference_month IS NULL AND c.created_at >= :monthStart AND c.created_at < :nextMonthStart))', { ref, monthStart, nextMonthStart })
    .getRawOne();

  const sales = await repos.sales
    .createQueryBuilder('s')
    .select('COUNT(*)', 'count')
    .addSelect('COALESCE(SUM(s.total_amount), 0)', 'total')
    .addSelect("COALESCE(SUM(CASE WHEN s.status IN ('pago','finalizado') THEN s.total_amount ELSE 0 END), 0)", 'paid')
    .where('s.technicianId = :technicianId', { technicianId })
    .andWhere("s.status != 'cancelado'")
    .andWhere('s.createdAt >= :monthStart AND s.createdAt < :nextMonthStart', { monthStart, nextMonthStart })
    .getRawOne();

  return {
    month: ref,
    serviceOrders: {
      open: openOrders.length,
      stale: openOrders.filter((o) => (nowMs - new Date(o.openedAt).getTime()) / DAY_MS >= STALE_DAYS).length,
      staleDays: STALE_DAYS,
      completedMonth: completedMonth.length,
      avgHoursToComplete: Math.round(avgHours * 10) / 10,
      active: openOrders.slice(0, 10).map((o) => ({
        id: o.id,
        number: o.number,
        customerName: o.customer?.name || '-',
        serviceType: o.serviceType,
        equipment: [o.equipment, o.brand, o.model].filter(Boolean).join(' '),
        statusKey: o.statusKey,
        statusLabel: statusByKey.get(o.statusKey)?.label || o.statusKey,
        statusColor: statusByKey.get(o.statusKey)?.color || '#6b7280',
        openedAt: o.openedAt,
        daysOpen: Math.max(0, Math.floor((nowMs - new Date(o.openedAt).getTime()) / DAY_MS)),
      })),
    },
    routes: {
      count: routeRows.length,
      km: routeRows.reduce((s, r) => s + Number(r.km || 0), 0),
      totalValue: routeRows.reduce((s, r) => s + Number(r.totalValue || 0), 0),
      byStatus,
      recent: routeRows.slice(0, 5).map((r) => ({ id: r.id, date: r.routeDate, description: r.description, km: Number(r.km), totalValue: Number(r.totalValue), status: r.status })),
    },
    commissions: { pending: Number(pending?.total || 0), paidMonth: Number(paid?.total || 0) },
    sales: { count: Number(sales?.count || 0), total: Number(sales?.total || 0), paid: Number(sales?.paid || 0) },
  };
}
