import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentsRevertedFlag1793600000000 implements MigrationInterface {
  name = 'PaymentsRevertedFlag1793600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS reverted_at timestamp`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE payments DROP COLUMN IF EXISTS reverted_at`);
  }
}
