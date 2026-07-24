import { MigrationInterface, QueryRunner } from 'typeorm';
export class CrmOpportunity1789000000000 implements MigrationInterface {
  name = 'CrmOpportunity1789000000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS "crm_opportunities" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "customer_id" uuid, "title" varchar(255) NOT NULL, "contact_name" varchar(255), "contact_email" varchar(255), "contact_phone" varchar(50), "stage" varchar(30) NOT NULL DEFAULT 'lead', "value" numeric(12,2) NOT NULL DEFAULT 0, "probability" integer NOT NULL DEFAULT 10, "expected_close_date" date, "lost_reason" text, "notes" text, "owner_id" uuid, "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now(), CONSTRAINT "PK_crm_opportunities" PRIMARY KEY("id"), CONSTRAINT "FK_crm_customer" FOREIGN KEY("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL, CONSTRAINT "FK_crm_owner" FOREIGN KEY("owner_id") REFERENCES "users"("id") ON DELETE SET NULL, CONSTRAINT "CHK_crm_probability" CHECK("probability" BETWEEN 0 AND 100), CONSTRAINT "CHK_crm_stage" CHECK("stage" IN ('lead','contato','proposta','negociacao','ganho','perdido')))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_crm_stage_close" ON "crm_opportunities"("stage","expected_close_date")`);
  }
  async down(q: QueryRunner): Promise<void> { await q.query(`DROP TABLE IF EXISTS "crm_opportunities"`); }
}
