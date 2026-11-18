import { MigrationInterface, QueryRunner } from 'typeorm';

export class PurchaseXmlEntry1795000000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE purchases ADD COLUMN IF NOT EXISTS xml_access_key varchar(44), ADD COLUMN IF NOT EXISTS imported_xml text');
    await runner.query('CREATE UNIQUE INDEX IF NOT EXISTS purchase_xml_access_key ON purchases(tenant_id, xml_access_key) WHERE xml_access_key IS NOT NULL');
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP INDEX purchase_xml_access_key');
    await runner.query('ALTER TABLE purchases DROP COLUMN imported_xml, DROP COLUMN xml_access_key');
  }
}
