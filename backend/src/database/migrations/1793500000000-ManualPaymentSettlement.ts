import { MigrationInterface, QueryRunner } from 'typeorm';

export class ManualPaymentSettlement1793500000000 implements MigrationInterface {
  name = 'ManualPaymentSettlement1793500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS settled_manually boolean DEFAULT false`);
    await queryRunner.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS settled_by uuid`);
    await queryRunner.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_note varchar(255)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE payments DROP COLUMN IF EXISTS payment_note`);
    await queryRunner.query(`ALTER TABLE payments DROP COLUMN IF EXISTS settled_by`);
    await queryRunner.query(`ALTER TABLE payments DROP COLUMN IF EXISTS settled_manually`);
  }
}
