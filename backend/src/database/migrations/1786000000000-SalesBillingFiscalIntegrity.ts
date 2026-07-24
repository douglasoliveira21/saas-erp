import { MigrationInterface, QueryRunner } from 'typeorm';

export class SalesBillingFiscalIntegrity1786000000000 implements MigrationInterface {
  name = 'SalesBillingFiscalIntegrity1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS operational_status varchar(30) NOT NULL DEFAULT 'aberta'`);
    await queryRunner.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS fiscal_status varchar(30) NOT NULL DEFAULT 'pendente'`);
    await queryRunner.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS billing_status varchar(30) NOT NULL DEFAULT 'nao_emitido'`);
    await queryRunner.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_status varchar(30) NOT NULL DEFAULT 'pendente'`);
    await queryRunner.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS archived_at timestamp`);
    await queryRunner.query(`UPDATE sales s SET operational_status = CASE WHEN s.status='cancelado' THEN 'cancelada' WHEN s.status='finalizado' THEN 'finalizada' ELSE 'aberta' END, fiscal_status = CASE WHEN EXISTS(SELECT 1 FROM invoices i WHERE i.sale_id=s.id AND i.status='autorizada') THEN 'autorizada' ELSE 'pendente' END, billing_status = CASE WHEN EXISTS(SELECT 1 FROM payments p WHERE p.sale_id=s.id AND p.status='pago') THEN 'pago' WHEN EXISTS(SELECT 1 FROM payments p WHERE p.sale_id=s.id AND p.status IN ('pendente','a_receber','vencido')) THEN 'emitido' ELSE 'nao_emitido' END, payment_status = CASE WHEN EXISTS(SELECT 1 FROM accounts_receivable a WHERE a.sale_id=s.id AND a.status='pago') THEN 'pago' WHEN EXISTS(SELECT 1 FROM accounts_receivable a WHERE a.sale_id=s.id AND a.status='parcial') THEN 'parcial' ELSE 'pendente' END`);
    await queryRunner.query(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM payments WHERE status IN ('pendente','a_receber','vencido') GROUP BY sale_id,type HAVING COUNT(*)>1) THEN RAISE EXCEPTION 'Existem cobrancas ativas duplicadas por venda/tipo; concilie antes da migration'; END IF; IF EXISTS(SELECT 1 FROM invoices WHERE sale_id IS NOT NULL AND status NOT IN ('cancelada','rejeitada','erro') GROUP BY sale_id,type HAVING COUNT(*)>1) THEN RAISE EXCEPTION 'Existem notas ativas duplicadas por venda/tipo; concilie antes da migration'; END IF; END $$;`);    await queryRunner.query(`ALTER TABLE installment_payments ADD COLUMN IF NOT EXISTS idempotency_key varchar(100)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_installment_payments_idempotency ON installment_payments(idempotency_key) WHERE idempotency_key IS NOT NULL`);
    await queryRunner.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_at timestamp`);
    await queryRunner.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotency_key varchar(100)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_active_sale_type ON payments(sale_id,type) WHERE status IN ('pendente','a_receber','vencido')`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_active_sale_type ON invoices(sale_id,type) WHERE sale_id IS NOT NULL AND status NOT IN ('cancelada','rejeitada','erro')`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_movement_single_reversal ON financial_movements(reference_id) WHERE reference_type='financial_movement_reversal'`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_statement_transaction ON bank_statements(bank_account,transaction_id) WHERE transaction_id IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_statement_movement ON bank_statements(matched_movement_id) WHERE matched_movement_id IS NOT NULL`);
    await queryRunner.query(`ALTER TABLE installments ADD CONSTRAINT chk_installment_paid_value CHECK (paid_value >= 0 AND paid_value <= value) NOT VALID`);
    await queryRunner.query(`ALTER TABLE accounts_receivable ADD CONSTRAINT chk_receivable_values CHECK (paid_value >= 0 AND pending_value >= 0 AND paid_value <= total_value) NOT VALID`);
    await queryRunner.query(`CREATE OR REPLACE FUNCTION protect_realized_financial_movement() RETURNS trigger AS $$ BEGIN IF TG_OP='DELETE' AND OLD.is_forecast=false THEN RAISE EXCEPTION 'Lancamento realizado e imutavel; use estorno'; END IF; IF TG_OP='UPDATE' AND OLD.is_forecast=false THEN RAISE EXCEPTION 'Lancamento realizado e imutavel; use estorno'; END IF; RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END; $$ LANGUAGE plpgsql`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_protect_realized_financial_movement ON financial_movements`);
    await queryRunner.query(`CREATE TRIGGER trg_protect_realized_financial_movement BEFORE UPDATE OR DELETE ON financial_movements FOR EACH ROW EXECUTE FUNCTION protect_realized_financial_movement()`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_protect_realized_financial_movement ON financial_movements`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS protect_realized_financial_movement`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bank_statement_movement`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bank_statement_transaction`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_movement_single_reversal`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invoice_active_sale_type`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_payments_active_sale_type`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_payments_idempotency`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_installment_payments_idempotency`);
  }
}