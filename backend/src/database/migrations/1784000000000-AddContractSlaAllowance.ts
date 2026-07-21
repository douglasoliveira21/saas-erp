import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContractSlaAllowance1784000000000 implements MigrationInterface {
  name = 'AddContractSlaAllowance1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS sla_total_hours numeric(10,2) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS sla_overage_rate numeric(10,2) NOT NULL DEFAULT 80`);
    await queryRunner.query(`ALTER TABLE glpi_tickets ALTER COLUMN sla_limit_hours TYPE numeric(10,2) USING sla_limit_hours::numeric`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE glpi_tickets ALTER COLUMN sla_limit_hours TYPE int USING ROUND(sla_limit_hours)::int`);
    await queryRunner.query(`ALTER TABLE contracts DROP COLUMN IF EXISTS sla_overage_rate`);
    await queryRunner.query(`ALTER TABLE contracts DROP COLUMN IF EXISTS sla_total_hours`);
  }
}