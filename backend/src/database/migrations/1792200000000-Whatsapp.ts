import { MigrationInterface, QueryRunner } from 'typeorm';

export class Whatsapp1792200000000 implements MigrationInterface {
  name = 'Whatsapp1792200000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "whatsapp_config" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "api_url" varchar(500),
        "api_key" text,
        "instance_name" varchar(100),
        "connection_status" varchar(20) NOT NULL DEFAULT 'desconectado',
        "phone_number" varchar(30),
        "last_checked_at" timestamp,
        "last_error" text,
        "notify_service_orders" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_whatsapp_config" PRIMARY KEY ("id")
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "whatsapp_message_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "phone" varchar(30) NOT NULL,
        "type" varchar(30) NOT NULL,
        "related_entity" varchar(40),
        "related_id" uuid,
        "preview" text,
        "status" varchar(20) NOT NULL,
        "error" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_whatsapp_message_logs" PRIMARY KEY ("id")
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_whatsapp_logs_related" ON "whatsapp_message_logs"("related_entity","related_id")`);

    await q.query(`ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "notify_via_whatsapp" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "whatsapp_number" varchar(30)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "contracts" DROP COLUMN IF EXISTS "whatsapp_number"`);
    await q.query(`ALTER TABLE "contracts" DROP COLUMN IF EXISTS "notify_via_whatsapp"`);
    await q.query(`DROP TABLE IF EXISTS "whatsapp_message_logs"`);
    await q.query(`DROP TABLE IF EXISTS "whatsapp_config"`);
  }
}
