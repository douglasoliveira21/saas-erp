import { MigrationInterface, QueryRunner } from 'typeorm';

// Com o escopo automático por tenant (common/tenant/tenant-scope.ts), cada tenant numera/cadastra
// suas próprias coisas. Unicidade global nessas colunas faria o segundo tenant bater no código
// do primeiro (ex.: orçamento nº 1, produto "001", placa já cadastrada). Troca por unicidade
// por tenant: UNIQUE (tenant_id, coluna).
const TARGETS: Array<[table: string, column: string]> = [
  ['products', 'code'],
  ['quotes', 'number'],
  ['chart_accounts', 'code'],
  ['cost_centers', 'code'],
  ['monthly_closings', 'period'],
  ['vehicles', 'plate'],
];

export class TenantScopedUniques1794300000000 implements MigrationInterface {
  name = 'TenantScopedUniques1794300000000';

  public async up(q: QueryRunner): Promise<void> {
    for (const [table, column] of TARGETS) {
      const exists = await q.query(`SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'tenant_id'`, [table]);
      if (!exists.length) continue;

      // Remove constraints UNIQUE de coluna única (nome gerado pelo banco/TypeORM varia).
      const constraints = await q.query(
        `SELECT c.conname FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
         WHERE t.relname = $1 AND c.contype = 'u' AND array_length(c.conkey, 1) = 1 AND a.attname = $2`,
        [table, column],
      );
      for (const { conname } of constraints) await q.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${conname}"`);

      // Índices UNIQUE soltos (sem constraint) sobre só essa coluna.
      const indexes = await q.query(
        `SELECT i.relname FROM pg_index x
         JOIN pg_class i ON i.oid = x.indexrelid
         JOIN pg_class t ON t.oid = x.indrelid
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.indkey[0]
         WHERE t.relname = $1 AND x.indisunique AND NOT x.indisprimary AND x.indnatts = 1 AND a.attname = $2`,
        [table, column],
      );
      for (const { relname } of indexes) await q.query(`DROP INDEX IF EXISTS "${relname}"`);

      await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_${table}_${column}_tenant" ON "${table}" ("tenant_id", "${column}")`);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const [table, column] of TARGETS) {
      await q.query(`DROP INDEX IF EXISTS "uq_${table}_${column}_tenant"`);
      await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_${table}_${column}" ON "${table}" ("${column}")`);
    }
  }
}
