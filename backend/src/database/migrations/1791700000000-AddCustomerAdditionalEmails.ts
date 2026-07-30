import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerAdditionalEmails1791700000000 implements MigrationInterface {
  name = 'AddCustomerAdditionalEmails1791700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS additional_emails jsonb NOT NULL DEFAULT '[]'::jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE customers DROP COLUMN IF EXISTS additional_emails`);
  }
}
