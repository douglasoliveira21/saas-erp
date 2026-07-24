import { MigrationInterface, QueryRunner } from 'typeorm';

export class SelectedSystemCorrections1787000000000 implements MigrationInterface {
  name = 'SelectedSystemCorrections1787000000000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS payments (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), sale_id uuid REFERENCES sales(id) ON DELETE SET NULL, customer_id uuid REFERENCES customers(id) ON DELETE SET NULL, type varchar(20) NOT NULL, codigo_solicitacao varchar(100), status varchar(30) DEFAULT 'a_receber', value decimal(10,2) NOT NULL DEFAULT 0, customer_name varchar(255), customer_doc varchar(20), due_date date, linha_digitavel text, pix_copia_e_cola text, nosso_numero varchar(50), idempotency_key varchar(150), created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now())`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`);
    await queryRunner.query(`ALTER TABLE financial_movements ADD COLUMN IF NOT EXISTS idempotency_key varchar(150)`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_movement_idempotency ON financial_movements(idempotency_key) WHERE idempotency_key IS NOT NULL`);
    await queryRunner.query(`ALTER TABLE monthly_closings ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'fechado', ADD COLUMN IF NOT EXISTS reopened_by uuid, ADD COLUMN IF NOT EXISTS reopened_at timestamp, ADD COLUMN IF NOT EXISTS reopen_reason text`);
    for (const table of ['customers','products','services','contracts','suppliers','users','vehicles','quotes','bills']) await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS archived_at timestamp`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS bill_payments (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), bill_id uuid NOT NULL REFERENCES bills(id), value decimal(10,2) NOT NULL, payment_method varchar(50), idempotency_key varchar(150), paid_at timestamp NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_bill_payment_idempotency ON bill_payments(idempotency_key) WHERE idempotency_key IS NOT NULL`);
    await queryRunner.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS sla_calculation_mode varchar(30) NOT NULL DEFAULT 'glpi_actiontime'`);
    await queryRunner.query(`ALTER TABLE glpi_tickets ADD COLUMN IF NOT EXISTS time_source varchar(30) NOT NULL DEFAULT 'elapsed'`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS sla_monthly_snapshots (id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), month varchar(7) NOT NULL, customer_id uuid NOT NULL REFERENCES customers(id), contract_id uuid REFERENCES contracts(id), included_hours decimal(12,2) NOT NULL DEFAULT 0, consumed_hours decimal(12,2) NOT NULL DEFAULT 0, exceeded_hours decimal(12,2) NOT NULL DEFAULT 0, overage_rate decimal(12,2) NOT NULL DEFAULT 0, total_charge decimal(12,2) NOT NULL DEFAULT 0, ticket_count integer NOT NULL DEFAULT 0, calculation_details jsonb NOT NULL DEFAULT '[]'::jsonb, is_frozen boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_sla_snapshot_month_contract ON sla_monthly_snapshots(month,customer_id,COALESCE(contract_id,'00000000-0000-0000-0000-000000000000'::uuid))`);
    await queryRunner.query(`UPDATE products SET quantity=0 WHERE quantity < 0`);
    await queryRunner.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='CHK_products_quantity_nonnegative') THEN ALTER TABLE products VALIDATE CONSTRAINT "CHK_products_quantity_nonnegative"; END IF; END $$`);
    await queryRunner.query(`CREATE OR REPLACE FUNCTION prevent_closed_period_movement() RETURNS trigger AS $$ DECLARE movement_date date; movement_period varchar(7); BEGIN movement_date := COALESCE(NEW.competence_date, NEW.date, OLD.competence_date, OLD.date); movement_period := to_char(movement_date,'YYYY-MM'); IF EXISTS (SELECT 1 FROM monthly_closings WHERE period=movement_period AND status='fechado') THEN RAISE EXCEPTION 'Período % está fechado', movement_period; END IF; RETURN COALESCE(NEW,OLD); END; $$ LANGUAGE plpgsql`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_financial_closed_period ON financial_movements`);
    await queryRunner.query(`CREATE TRIGGER trg_financial_closed_period BEFORE INSERT OR UPDATE OR DELETE ON financial_movements FOR EACH ROW EXECUTE FUNCTION prevent_closed_period_movement()`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_financial_closed_period ON financial_movements`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_closed_period_movement`);
    await queryRunner.query(`DROP TABLE IF EXISTS sla_monthly_snapshots`);
    await queryRunner.query(`DROP TABLE IF EXISTS bill_payments`);
    for (const table of ['customers','products','services','contracts','suppliers','users','vehicles','quotes','bills']) await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS archived_at`);
    await queryRunner.query(`ALTER TABLE contracts DROP COLUMN IF EXISTS sla_calculation_mode`);
    await queryRunner.query(`ALTER TABLE glpi_tickets DROP COLUMN IF EXISTS time_source`);
    await queryRunner.query(`ALTER TABLE financial_movements DROP COLUMN IF EXISTS idempotency_key`);
    await queryRunner.query(`ALTER TABLE monthly_closings DROP COLUMN IF EXISTS status, DROP COLUMN IF EXISTS reopened_by, DROP COLUMN IF EXISTS reopened_at, DROP COLUMN IF EXISTS reopen_reason`);
  }
}
