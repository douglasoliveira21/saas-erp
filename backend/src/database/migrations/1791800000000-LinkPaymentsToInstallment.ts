import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkPaymentsToInstallment1791800000000 implements MigrationInterface {
  name = 'LinkPaymentsToInstallment1791800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS installment_id uuid`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_payments_installment_id ON payments(installment_id)`);
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_payments_installment_id') THEN
        ALTER TABLE payments ADD CONSTRAINT fk_payments_installment_id FOREIGN KEY(installment_id) REFERENCES installments(id) ON DELETE SET NULL;
      END IF;
    END $$`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE payments DROP CONSTRAINT IF EXISTS fk_payments_installment_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_payments_installment_id`);
    await queryRunner.query(`ALTER TABLE payments DROP COLUMN IF EXISTS installment_id`);
  }
}
