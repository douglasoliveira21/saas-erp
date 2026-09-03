import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddCrmOpportunitySourceAndTags1792000000000 implements MigrationInterface {
  name = 'AddCrmOpportunitySourceAndTags1792000000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "crm_opportunities" ADD COLUMN IF NOT EXISTS "source" varchar(30)`);
    await q.query(`ALTER TABLE "crm_opportunities" ADD COLUMN IF NOT EXISTS "tags" jsonb NOT NULL DEFAULT '[]'::jsonb`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "crm_opportunities" DROP COLUMN IF EXISTS "tags"`);
    await q.query(`ALTER TABLE "crm_opportunities" DROP COLUMN IF EXISTS "source"`);
  }
}
