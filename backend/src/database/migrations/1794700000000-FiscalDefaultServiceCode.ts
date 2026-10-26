import { MigrationInterface, QueryRunner } from 'typeorm';

// Codigo de Tributacao Nacional padrao por tenant (cTribNac): cada empresa presta um servico diferente,
// entao o padrao nao pode ser sempre 01.07.01.
export class FiscalDefaultServiceCode1794700000000 implements MigrationInterface {
  name = 'FiscalDefaultServiceCode1794700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "fiscal_config" ADD COLUMN IF NOT EXISTS "default_service_code" varchar(6)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "fiscal_config" DROP COLUMN IF EXISTS "default_service_code"`);
  }
}
