import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNfseTaxDetails1781000000000 implements MigrationInterface {
  name = 'AddNfseTaxDetails1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_details jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE invoices DROP COLUMN IF EXISTS tax_details`);
  }
}
