import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Tenant } from './entities/tenant.entity';
import { Plan } from './entities/plan.entity';
import { UsersService } from '../users/users.service';
import { UserRole } from '../../common/enums/user-role.enum';

// Mesma lista de MultiTenantFoundation (1793000000000) + "payments" (adicionada depois, em
// 1793400000000). "tenant_bank_configs" fica de fora de propósito: sua FK já é ON DELETE CASCADE,
// então some sozinha quando a linha do tenant é removida no passo final.
const TENANT_SCOPED_TABLES = [
  'users', 'customers', 'products', 'services', 'vehicles', 'suppliers', 'quotes',
  'sales', 'sale_items', 'sale_events', 'sale_attachments',
  'commissions', 'contracts',
  'service_orders', 'service_order_statuses', 'service_order_attachments', 'service_order_events',
  'crm_opportunities',
  'financial_movements', 'installments', 'installment_payments', 'accounts_receivable',
  'accounts_payable', 'bank_accounts', 'card_fees', 'customer_credits', 'monthly_closings',
  'chart_accounts', 'cost_centers', 'financial_tasks',
  'invoices', 'certificates', 'fiscal_events', 'fiscal_config',
  'glpi_config', 'glpi_tickets', 'sla_monthly_snapshots',
  'whatsapp_config', 'whatsapp_message_logs',
  'inter_webhook_events',
  'email_configs', 'email_delivery_logs',
  'purchases', 'purchase_items', 'purchase_quotes', 'purchase_attachments',
  'bills', 'routes', 'route_legs',
  'stock_movements', 'stock_inventories',
  'bank_statements',
  'audit_logs',
  'portal_users', 'portal_tickets', 'portal_ticket_forms',
  'auth_sessions', 'password_resets',
  'payments',
];

function slugify(value: string): string {
  return value
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'tenant';
}

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant) private tenantsRepository: Repository<Tenant>,
    @InjectRepository(Plan) private plansRepository: Repository<Plan>,
    private usersService: UsersService,
  ) {}

  async findAll() {
    const tenants = await this.tenantsRepository.find({ relations: ['plan'], order: { createdAt: 'DESC' } });
    // Uso atual de cada tenant (só contagem de usuários por enquanto — os demais limites do
    // plano passam a ser medidos módulo a módulo conforme cada um for migrado, Fase 3).
    const usage = await this.tenantsRepository.manager.query(
      `SELECT tenant_id, COUNT(*)::int AS user_count FROM users GROUP BY tenant_id`,
    );
    const usageMap = new Map(usage.map((row: any) => [row.tenant_id, row.user_count]));
    return tenants.map((tenant) => ({ ...tenant, userCount: usageMap.get(tenant.id) || 0 }));
  }

  async findOne(id: string) {
    const tenant = await this.tenantsRepository.findOne({ where: { id }, relations: ['plan'] });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    return tenant;
  }

  // Usado pelo PlanGuard e pelo login (JwtStrategy) — sem cache por enquanto, é uma consulta
  // simples por id indexado; se o volume de requisições justificar, dá pra cachear por alguns
  // segundos depois.
  async getEnabledModules(tenantId: string): Promise<string[]> {
    const tenant = await this.tenantsRepository.findOne({ where: { id: tenantId }, relations: ['plan'] });
    return tenant?.plan?.modules || [];
  }

  async getTenantStatus(tenantId: string): Promise<string | null> {
    const tenant = await this.tenantsRepository.findOne({ where: { id: tenantId } });
    return tenant?.status || null;
  }

  // Lança se o uso atual já atingiu o limite do plano. limit undefined/null = sem limite
  // configurado (plano "ilimitado" nesse quesito) — só bloqueia quando o limite existe.
  async assertWithinLimit(tenantId: string, limitKey: 'maxUsers' | 'maxInvoicesPerMonth' | 'maxServiceOrdersPerMonth', currentCount: number, message: string): Promise<void> {
    const tenant = await this.tenantsRepository.findOne({ where: { id: tenantId }, relations: ['plan'] });
    const limit = tenant?.plan?.limits?.[limitKey];
    if (limit != null && currentCount >= limit) {
      throw new BadRequestException(message);
    }
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = slugify(base);
    let attempt = 0;
    while (await this.tenantsRepository.findOne({ where: { slug } })) {
      attempt += 1;
      slug = `${slugify(base)}-${attempt + 1}`;
    }
    return slug;
  }

  // Cria o tenant e já provisiona o primeiro usuário admin dele — sem isso, ninguém consegue
  // logar no tenant recém-criado. A senha temporária só existe em texto puro no retorno desta
  // chamada (nunca é armazenada nem logada); o super admin repassa para o cliente uma vez.
  async create(dto: { name: string; document?: string; planId?: string; adminName: string; adminEmail: string }) {
    if (!dto.name?.trim()) throw new BadRequestException('Informe o nome do cliente');
    if (!dto.adminName?.trim() || !dto.adminEmail?.trim()) throw new BadRequestException('Informe nome e email do administrador do cliente');
    if (dto.planId) {
      const plan = await this.plansRepository.findOne({ where: { id: dto.planId } });
      if (!plan) throw new BadRequestException('Plano inválido');
    }

    const slug = await this.uniqueSlug(dto.name);
    const tenant = await this.tenantsRepository.save(
      this.tenantsRepository.create({ name: dto.name.trim(), slug, document: dto.document || null, planId: dto.planId || null, status: 'ativo' }),
    );

    const tempPassword = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
    await this.usersService.create(
      { name: dto.adminName.trim(), email: dto.adminEmail.trim().toLowerCase(), password: tempPassword, role: UserRole.ADMIN } as any,
      tenant.id,
    );

    return { tenant: await this.findOne(tenant.id), adminEmail: dto.adminEmail.trim().toLowerCase(), tempPassword };
  }

  // Resumo para o dashboard do painel do super admin: contagem de tenants por status, usuários
  // totais, MRR estimado (planos mensais somados + planos anuais divididos por 12) só de tenants
  // ativos, distribuição por plano, e o crescimento (tenants criados) dos últimos 6 meses.
  async getDashboard() {
    const tenants = await this.tenantsRepository.find({ relations: ['plan'] });
    const byStatus = { ativo: 0, suspenso: 0, cancelado: 0 } as Record<string, number>;
    let mrr = 0;
    const planCounts = new Map<string, { name: string; count: number }>();
    for (const tenant of tenants) {
      byStatus[tenant.status] = (byStatus[tenant.status] || 0) + 1;
      if (tenant.plan) {
        const key = tenant.plan.id;
        const entry = planCounts.get(key) || { name: tenant.plan.name, count: 0 };
        entry.count += 1;
        planCounts.set(key, entry);
        if (tenant.status === 'ativo') {
          const price = Number(tenant.plan.price || 0);
          mrr += tenant.plan.billingCycle === 'anual' ? price / 12 : price;
        }
      }
    }

    const userCountRow = await this.tenantsRepository.manager.query(`SELECT COUNT(*)::int AS total FROM users WHERE archived_at IS NULL`);
    const totalUsers = Number(userCountRow[0]?.total || 0);

    const monthlyGrowth = await this.tenantsRepository.manager.query(
      `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, COUNT(*)::int AS count
       FROM tenants
       WHERE created_at >= date_trunc('month', now()) - interval '5 months'
       GROUP BY 1 ORDER BY 1`,
    );

    const recentTenants = [...tenants]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map((t) => ({ id: t.id, name: t.name, status: t.status, planName: t.plan?.name || null, createdAt: t.createdAt }));

    return {
      totalTenants: tenants.length,
      byStatus,
      totalUsers,
      mrr: Math.round(mrr * 100) / 100,
      planDistribution: Array.from(planCounts.values()),
      monthlyGrowth,
      recentTenants,
    };
  }

  async update(id: string, dto: { name?: string; document?: string; planId?: string; status?: string }) {
    const tenant = await this.findOne(id);
    if (dto.planId !== undefined) {
      if (dto.planId) {
        const plan = await this.plansRepository.findOne({ where: { id: dto.planId } });
        if (!plan) throw new BadRequestException('Plano inválido');
      }
      tenant.planId = dto.planId || null;
    }
    if (dto.name !== undefined) tenant.name = dto.name.trim();
    if (dto.document !== undefined) tenant.document = dto.document || null;
    if (dto.status !== undefined) {
      if (!['ativo', 'suspenso', 'cancelado'].includes(dto.status)) throw new BadRequestException('Status inválido');
      tenant.status = dto.status;
    }
    await this.tenantsRepository.save(tenant);
    return this.findOne(id);
  }

  // Exclusão permanente do tenant e de TODOS os seus dados de negócio. Irreversível.
  //
  // Não dá pra confiar numa ordem fixa de tabelas para evitar violação de FK (o grafo de
  // referências entre ~50 tabelas tem exceções — ex.: installments pode referenciar
  // accounts_receivable, que por sua vez referencia sales). Em vez de mapear isso à mão, cada
  // tabela é tentada dentro de um SAVEPOINT; quem falhar por FK volta pro fim da fila e é
  // tentado de novo na próxima passada, até sobrar só o que realmente não tem mais dependente.
  // Tudo dentro de uma única transação: ou tudo é apagado, ou nada é (rollback total em caso de
  // ficar preso, sem deixar o tenant pela metade).
  async remove(id: string, confirmName: string): Promise<{ success: true }> {
    const tenant = await this.findOne(id);
    if (!confirmName || confirmName !== tenant.name) {
      throw new BadRequestException('Confirmação inválida: digite exatamente o nome do cliente para excluir.');
    }

    await this.tenantsRepository.manager.transaction(async (manager) => {
      let pending = [...TENANT_SCOPED_TABLES];
      let lastError = '';
      for (let pass = 0; pending.length && pass < TENANT_SCOPED_TABLES.length + 2; pass++) {
        const stillPending: string[] = [];
        for (const table of pending) {
          const exists = await manager.query(`SELECT to_regclass($1) IS NOT NULL AS exists`, [`public.${table}`]);
          if (!exists[0]?.exists) continue; // tabela não existe neste ambiente

          await manager.query(`SAVEPOINT tenant_delete`);
          try {
            await manager.query(`DELETE FROM "${table}" WHERE tenant_id = $1`, [id]);
            await manager.query(`RELEASE SAVEPOINT tenant_delete`);
          } catch (error: any) {
            await manager.query(`ROLLBACK TO SAVEPOINT tenant_delete`);
            lastError = error.message;
            stillPending.push(table);
          }
        }
        pending = stillPending;
      }
      if (pending.length) {
        throw new BadRequestException(`Não foi possível remover os dados do cliente (tabelas presas: ${pending.join(', ')}). Último erro: ${lastError}`);
      }
      await manager.query(`DELETE FROM "tenants" WHERE id = $1`, [id]);
    });

    return { success: true };
  }
}
