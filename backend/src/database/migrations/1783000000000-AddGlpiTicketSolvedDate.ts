import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGlpiTicketSolvedDate1783000000000 implements MigrationInterface {
  name = 'AddGlpiTicketSolvedDate1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE glpi_tickets ADD COLUMN IF NOT EXISTS date_solved timestamp`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE glpi_tickets DROP COLUMN IF EXISTS date_solved`);
  }
}