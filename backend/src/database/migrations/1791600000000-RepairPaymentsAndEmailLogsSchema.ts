import { MigrationInterface, QueryRunner } from 'typeorm';

export class RepairPaymentsAndEmailLogsSchema1791600000000 implements MigrationInterface {
  name = 'RepairPaymentsAndEmailLogsSchema1791600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS account_id uuid`);
    await queryRunner.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_at timestamp`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_payments_account_id ON payments(account_id)`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS email_delivery_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipient varchar(500) NOT NULL,
      subject varchar(500) NOT NULL, provider varchar(30) NOT NULL DEFAULT 'smtp',
      status varchar(20) NOT NULL, error_message text, attachment_count integer NOT NULL DEFAULT 0,
      is_test boolean NOT NULL DEFAULT false, user_id uuid, created_at timestamp NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_created_at ON email_delivery_logs(created_at DESC)`);
    await queryRunner.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_payments_account_id') THEN
        ALTER TABLE payments ADD CONSTRAINT fk_payments_account_id FOREIGN KEY(account_id) REFERENCES accounts_receivable(id) ON DELETE SET NULL;
      END IF;
    END $$`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE payments DROP CONSTRAINT IF EXISTS fk_payments_account_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_payments_account_id`);
    await queryRunner.query(`ALTER TABLE payments DROP COLUMN IF EXISTS account_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_email_delivery_logs_created_at`);
  }
}
