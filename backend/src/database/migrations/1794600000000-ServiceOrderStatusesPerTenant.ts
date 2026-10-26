import { MigrationInterface, QueryRunner } from 'typeorm';

// Os status de ordem de serviço só existiam para o primeiro tenant (criados na migration original,
// com a chave unica globalmente). Tenants novos ficavam sem nenhum status: a OS abria como
// "iniciando" mas nao havia opcoes para evoluir. Aqui a chave passa a ser unica por tenant e todo
// tenant sem status recebe os padroes.
export class ServiceOrderStatusesPerTenant1794600000000 implements MigrationInterface {
  name = 'ServiceOrderStatusesPerTenant1794600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "service_order_statuses" DROP CONSTRAINT IF EXISTS "UQ_service_order_status_key"`);
    await q.query(`DROP INDEX IF EXISTS "UQ_service_order_status_key"`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_service_order_statuses_key_tenant" ON "service_order_statuses" ("tenant_id", "key")`);
    await q.query(`
      INSERT INTO "service_order_statuses" ("tenant_id","key","label","color","sort_order","is_final")
      SELECT t.id, v.key, v.label, v.color, v.sort_order, v.is_final
      FROM tenants t
      CROSS JOIN (VALUES
        ('iniciando', 'Iniciando', '#3b82f6', 1, false),
        ('cotando_pecas', 'Cotando peças', '#f59e0b', 2, false),
        ('em_manutencao', 'Realizando manutenção', '#8b5cf6', 3, false),
        ('aguardando_cliente', 'Aguardando cliente', '#eab308', 4, false),
        ('concluida', 'Concluída', '#22c55e', 5, true),
        ('cancelada', 'Cancelada', '#ef4444', 6, true)
      ) AS v(key, label, color, sort_order, is_final)
      WHERE NOT EXISTS (SELECT 1 FROM "service_order_statuses" s WHERE s.tenant_id = t.id)
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "uq_service_order_statuses_key_tenant"`);
  }
}
