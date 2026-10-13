import { MigrationInterface, QueryRunner } from 'typeorm';

// Cada tenant tem o próprio GLPI, então o número do chamado só é único dentro do tenant: dois
// tenants podem ter o chamado nº 5 em servidores GLPI diferentes. Troca UNIQUE (glpi_ticket_id)
// por UNIQUE (tenant_id, glpi_ticket_id).
export class PortalTicketTenantUnique1794400000000 implements MigrationInterface {
  name = 'PortalTicketTenantUnique1794400000000';

  public async up(q: QueryRunner): Promise<void> {
    const hasTenant = await q.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'portal_tickets' AND column_name = 'tenant_id'`);
    if (!hasTenant.length) return;

    const constraints = await q.query(
      `SELECT c.conname FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
       WHERE t.relname = 'portal_tickets' AND c.contype = 'u' AND array_length(c.conkey, 1) = 1 AND a.attname = 'glpi_ticket_id'`,
    );
    for (const { conname } of constraints) await q.query(`ALTER TABLE "portal_tickets" DROP CONSTRAINT "${conname}"`);

    const indexes = await q.query(
      `SELECT i.relname FROM pg_index x
       JOIN pg_class i ON i.oid = x.indexrelid
       JOIN pg_class t ON t.oid = x.indrelid
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.indkey[0]
       WHERE t.relname = 'portal_tickets' AND x.indisunique AND NOT x.indisprimary AND x.indnatts = 1 AND a.attname = 'glpi_ticket_id'`,
    );
    for (const { relname } of indexes) await q.query(`DROP INDEX IF EXISTS "${relname}"`);

    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_portal_tickets_glpi_ticket_id_tenant" ON "portal_tickets" ("tenant_id", "glpi_ticket_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "uq_portal_tickets_glpi_ticket_id_tenant"`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_portal_tickets_glpi_ticket_id" ON "portal_tickets" ("glpi_ticket_id")`);
  }
}
