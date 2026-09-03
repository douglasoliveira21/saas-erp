import { MigrationInterface, QueryRunner } from 'typeorm';

// Tabelas de negócio existentes que passam a pertencer a um tenant. Tabelas "filhas" (itens,
// eventos, anexos) recebem a coluna também (denormalizado), em vez de depender de join com o
// pai, para que cada tabela possa ter sua própria política de isolamento no futuro sem
// depender de outra tabela estar correta.
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
];

export class MultiTenantFoundation1793000000000 implements MigrationInterface {
  name = 'MultiTenantFoundation1793000000000';

  async up(q: QueryRunner): Promise<void> {
    // === Camada de plataforma (não pertence a nenhum tenant) ===
    await q.query(`
      CREATE TABLE IF NOT EXISTS "plans" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(120) NOT NULL,
        "description" text,
        "price" numeric(10,2) NOT NULL DEFAULT 0,
        "billing_cycle" varchar(20) NOT NULL DEFAULT 'mensal',
        "modules" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "limits" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_plans" PRIMARY KEY ("id")
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "tenants" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "slug" varchar(80) NOT NULL,
        "document" varchar(20),
        "status" varchar(20) NOT NULL DEFAULT 'ativo',
        "plan_id" uuid,
        "trial_ends_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenants" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tenants_slug" UNIQUE ("slug"),
        CONSTRAINT "FK_tenants_plan" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL
      )
    `);

    // Login do super admin fica numa tabela própria, nunca dentro de "users" — evita que um bug
    // de query num módulo de tenant consiga enxergar ou se passar por um super admin.
    await q.query(`
      CREATE TABLE IF NOT EXISTS "super_admins" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "email" varchar(255) NOT NULL,
        "password" varchar(255) NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "last_login_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_super_admins" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_super_admins_email" UNIQUE ("email")
      )
    `);

    // === Semente: plano legado + tenant VGON (dados que já existem viram o tenant 1) ===
    const planResult = await q.query(`
      INSERT INTO "plans" ("name", "description", "price", "modules", "limits", "sort_order")
      VALUES (
        'Legado - acesso total',
        'Plano criado automaticamente na migração para o cliente que já operava o sistema antes do multi-tenant.',
        0,
        '["dashboard","sales","pdv","crm","orcamentos","pre_vendas","vendas_recorrentes","contracts","products","services","stock","estoque_avancado","compras","commissions","financeiro","contas_pagar","pagamentos","conciliacao","dre","reports","financeiro_avancado","fiscal","fiscal_avancado","inter_avancado","relacionamento","service_orders","routes","vehicles","sla","controles_erp","users","customer_portal","email_settings","whatsapp_settings"]'::jsonb,
        '{"maxUsers": 9999, "maxInvoicesPerMonth": 999999, "maxServiceOrdersPerMonth": 999999}'::jsonb,
        0
      )
      RETURNING id
    `);
    const planId = planResult[0].id;

    const existingConfig = await q.query(`SELECT company_name, cnpj FROM fiscal_config LIMIT 1`).catch(() => []);
    const tenantName = existingConfig[0]?.company_name || 'Empresa principal';
    const tenantDocument = existingConfig[0]?.cnpj || null;

    const tenantResult = await q.query(`
      INSERT INTO "tenants" ("name", "slug", "document", "status", "plan_id")
      VALUES ($1, 'vgon', $2, 'ativo', $3)
      RETURNING id
    `, [tenantName, tenantDocument, planId]);
    const tenantId = tenantResult[0].id;

    // === tenant_id em toda tabela de negócio existente, já preenchido para o tenant migrado ===
    //
    // IMPORTANTE: a coluna recebe um DEFAULT igual ao tenant migrado (VGON). Isso é proposital
    // e temporário — nenhum dos ~50 services do sistema foi alterado ainda para popular
    // tenant_id explicitamente ao criar um registro (isso é trabalho das próximas fases,
    // módulo por módulo). Sem esse default, toda criação de usuário/venda/cliente/etc quebraria
    // agora mesmo com "null value in column tenant_id violates not-null constraint". Com o
    // default, o sistema continua funcionando exatamente como hoje (só existe um tenant mesmo),
    // e cada módulo troca o default por um valor explícito quando for migrado para
    // multi-tenant de verdade.
    for (const table of TENANT_SCOPED_TABLES) {
      const exists = await q.query(`SELECT to_regclass($1) IS NOT NULL AS exists`, [`public.${table}`]);
      if (!exists[0]?.exists) continue; // tabela ainda não existe neste ambiente (ex.: deploy novo) — nada a migrar

      await q.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "tenant_id" uuid`);
      await q.query(`UPDATE "${table}" SET "tenant_id" = $1 WHERE "tenant_id" IS NULL`, [tenantId]);
      await q.query(`ALTER TABLE "${table}" ALTER COLUMN "tenant_id" SET DEFAULT '${tenantId}'`);
      await q.query(`ALTER TABLE "${table}" ALTER COLUMN "tenant_id" SET NOT NULL`);

      const fkName = `FK_${table}_tenant`;
      const fkExists = await q.query(`SELECT 1 FROM pg_constraint WHERE conname = $1`, [fkName]);
      if (!fkExists.length) {
        await q.query(`ALTER TABLE "${table}" ADD CONSTRAINT "${fkName}" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT`);
      }
      await q.query(`CREATE INDEX IF NOT EXISTS "IDX_${table}_tenant" ON "${table}" ("tenant_id")`);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    for (const table of TENANT_SCOPED_TABLES) {
      const exists = await q.query(`SELECT to_regclass($1) IS NOT NULL AS exists`, [`public.${table}`]);
      if (!exists[0]?.exists) continue;
      await q.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "FK_${table}_tenant"`);
      await q.query(`DROP INDEX IF EXISTS "IDX_${table}_tenant"`);
      await q.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "tenant_id"`);
    }
    await q.query(`DROP TABLE IF EXISTS "super_admins"`);
    await q.query(`DROP TABLE IF EXISTS "tenants"`);
    await q.query(`DROP TABLE IF EXISTS "plans"`);
  }
}
