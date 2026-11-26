import { MigrationInterface, QueryRunner } from 'typeorm';

// Os status de OS passam a ser filtrados por tenant. Antes disso eram compartilhados: tenant criado
// depois da migração anterior não ganhava os padrões, e status criado por qualquer empresa era
// gravado no tenant legado. Aqui cada tenant recebe o que precisa para não ficar sem opções.
export class ServiceOrderStatusesTenantBackfill1795100000000 implements MigrationInterface {
  name = 'ServiceOrderStatusesTenantBackfill1795100000000';

  public async up(q: QueryRunner): Promise<void> {
    // 1) Padrões para quem não tem nenhum status.
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
    // 2) Status em uso nas OS de um tenant mas cadastrado em outro: copia para o dono da OS.
    await q.query(`
      INSERT INTO "service_order_statuses" ("tenant_id","key","label","color","sort_order","is_final","active")
      SELECT DISTINCT ON (o.tenant_id, s.key) o.tenant_id, s.key, s.label, s.color, s.sort_order, s.is_final, s.active
      FROM "service_orders" o
      JOIN "service_order_statuses" s ON s.key = o.status_key
      WHERE NOT EXISTS (SELECT 1 FROM "service_order_statuses" own WHERE own.tenant_id = o.tenant_id AND own.key = o.status_key)
      ORDER BY o.tenant_id, s.key, s.created_at
    `);
  }

  // Sem volta: não há como distinguir as linhas criadas aqui das cadastradas depois.
  public async down(): Promise<void> {}
}
