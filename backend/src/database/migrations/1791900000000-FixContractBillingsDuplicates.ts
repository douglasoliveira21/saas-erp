import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * contract_billings was created ad-hoc (no migration, no unique constraint) by
 * ContractBillingService's CREATE TABLE IF NOT EXISTS fallback. Without a unique
 * constraint on (contract_id, billing_period), generateBilling() could insert a
 * new row every retry instead of updating the existing one, and
 * getBillingStatusForPeriod()'s `SELECT ... LIMIT 1` (no ORDER BY) could then
 * return an arbitrary/stale duplicate — showing a contract's NF/boleto status
 * as wrong (missing an invoice that was actually authorized, or vice versa).
 *
 * This migration merges duplicate rows per (contract_id, billing_period),
 * keeping the most complete invoice_id/boleto_code across duplicates, then adds
 * the missing unique constraint so it can't happen again.
 */
export class FixContractBillingsDuplicates1791900000000 implements MigrationInterface {
  name = 'FixContractBillingsDuplicates1791900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name='contract_billings'`,
    );
    if (!tableExists.length) return;

    // Prefer the invoice_id whose invoice is actually 'autorizada' over just the most recent
    // one — a duplicate-emission retry can create a *newer* invoice that later gets cancelled,
    // while an *older* invoice_id in another duplicate row was the one that actually succeeded.
    await queryRunner.query(`
      CREATE TEMP TABLE cb_merge AS
      SELECT
        cb.contract_id,
        cb.billing_period,
        (array_agg(cb.id ORDER BY (i.status = 'autorizada') DESC NULLS LAST, (cb.invoice_id IS NOT NULL) DESC, (cb.boleto_code IS NOT NULL) DESC, cb.created_at DESC))[1] AS keep_id,
        (array_agg(cb.invoice_id ORDER BY (i.status = 'autorizada') DESC NULLS LAST, cb.invoice_id IS NULL, cb.created_at DESC))[1] AS merged_invoice_id,
        (array_agg(cb.boleto_code ORDER BY cb.boleto_code IS NULL, cb.created_at DESC))[1] AS merged_boleto_code
      FROM contract_billings cb
      LEFT JOIN invoices i ON i.id = cb.invoice_id
      GROUP BY cb.contract_id, cb.billing_period
    `);

    await queryRunner.query(`
      UPDATE contract_billings cb
      SET invoice_id = m.merged_invoice_id, boleto_code = m.merged_boleto_code, updated_at = NOW()
      FROM cb_merge m
      WHERE cb.id = m.keep_id
    `);

    await queryRunner.query(`
      DELETE FROM contract_billings cb
      WHERE NOT EXISTS (SELECT 1 FROM cb_merge m WHERE m.keep_id = cb.id)
    `);

    await queryRunner.query(`DROP TABLE cb_merge`);

    await queryRunner.query(`ALTER TABLE contract_billings ALTER COLUMN updated_at SET DEFAULT NOW()`).catch(() => {});
    await queryRunner.query(`ALTER TABLE contract_billings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`).catch(() => {});

    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='uq_contract_billings_contract_period') THEN
        ALTER TABLE contract_billings ADD CONSTRAINT uq_contract_billings_contract_period UNIQUE (contract_id, billing_period);
      END IF;
    END $$`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE contract_billings DROP CONSTRAINT IF EXISTS uq_contract_billings_contract_period`);
  }
}
