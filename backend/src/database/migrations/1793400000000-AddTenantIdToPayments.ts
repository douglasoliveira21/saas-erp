import { MigrationInterface, QueryRunner } from 'typeorm';

// A tabela "payments" (boletos/PIX do Banco Inter) ficou de fora da lista de tabelas migradas em
// MultiTenantFoundation (1793000000000) — sem tenant_id, a conciliação e o webhook do Inter não
// tinham como isolar pagamentos entre tenants diferentes. Mesmo padrão usado lá: DEFAULT para o
// tenant migrado (VGON) antes do NOT NULL, para não quebrar nenhum insert/update em produção.
export class AddTenantIdToPayments1793400000000 implements MigrationInterface {
  name = 'AddTenantIdToPayments1793400000000';

  public async up(q: QueryRunner): Promise<void> {
    const exists = await q.query(`SELECT to_regclass('public.payments') IS NOT NULL AS exists`);
    if (!exists[0]?.exists) return;

    const tenant = await q.query(`SELECT id FROM tenants WHERE slug = 'vgon' LIMIT 1`);
    if (!tenant.length) return; // ambiente sem a fundação multi-tenant ainda aplicada — nada a fazer
    const tenantId = tenant[0].id;

    await q.query(`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "tenant_id" uuid`);
    await q.query(`UPDATE "payments" SET "tenant_id" = $1 WHERE "tenant_id" IS NULL`, [tenantId]);
    await q.query(`ALTER TABLE "payments" ALTER COLUMN "tenant_id" SET DEFAULT '${tenantId}'`);
    await q.query(`ALTER TABLE "payments" ALTER COLUMN "tenant_id" SET NOT NULL`);

    const fkExists = await q.query(`SELECT 1 FROM pg_constraint WHERE conname = 'FK_payments_tenant'`);
    if (!fkExists.length) {
      await q.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT`);
    }
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_payments_tenant" ON "payments" ("tenant_id")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    const exists = await q.query(`SELECT to_regclass('public.payments') IS NOT NULL AS exists`);
    if (!exists[0]?.exists) return;
    await q.query(`ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "FK_payments_tenant"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_payments_tenant"`);
    await q.query(`ALTER TABLE "payments" DROP COLUMN IF EXISTS "tenant_id"`);
  }
}
