import { MigrationInterface, QueryRunner } from 'typeorm';

export class ServiceOrders1792100000000 implements MigrationInterface {
  name = 'ServiceOrders1792100000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "service_order_statuses" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" varchar(40) NOT NULL,
        "label" varchar(80) NOT NULL,
        "color" varchar(20) NOT NULL DEFAULT '#6b7280',
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_final" boolean NOT NULL DEFAULT false,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_service_order_statuses" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_service_order_status_key" UNIQUE ("key")
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "service_orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "number" SERIAL,
        "customer_id" uuid NOT NULL,
        "technician_id" uuid,
        "service_type" varchar(120) NOT NULL,
        "description" text NOT NULL,
        "status_key" varchar(40) NOT NULL DEFAULT 'iniciando',
        "opened_at" timestamp NOT NULL DEFAULT now(),
        "started_at" timestamp,
        "completed_at" timestamp,
        "conclusion_description" text,
        "parts_cost" numeric(10,2) NOT NULL DEFAULT 0,
        "labor_cost" numeric(10,2) NOT NULL DEFAULT 0,
        "total_cost" numeric(10,2) NOT NULL DEFAULT 0,
        "created_by" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_service_orders" PRIMARY KEY ("id"),
        CONSTRAINT "FK_service_orders_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_service_orders_technician" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_service_orders_customer" ON "service_orders"("customer_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_service_orders_technician" ON "service_orders"("technician_id")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_service_orders_status" ON "service_orders"("status_key")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "service_order_attachments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "service_order_id" uuid NOT NULL,
        "type" varchar(20) NOT NULL DEFAULT 'geral',
        "filename" varchar(255) NOT NULL,
        "mime_type" varchar(120),
        "storage_path" text NOT NULL,
        "uploaded_by" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_service_order_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_service_order_attachments_order" FOREIGN KEY ("service_order_id") REFERENCES "service_orders"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_service_order_attachment_type" CHECK ("type" IN ('foto_antes','foto_depois','documento','geral'))
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_service_order_attachments_order" ON "service_order_attachments"("service_order_id")`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "service_order_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "service_order_id" uuid NOT NULL,
        "type" varchar(50) NOT NULL,
        "status_key" varchar(40),
        "description" text,
        "metadata" jsonb,
        "created_by" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_service_order_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_service_order_events_order" FOREIGN KEY ("service_order_id") REFERENCES "service_orders"("id") ON DELETE CASCADE
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_service_order_events_order" ON "service_order_events"("service_order_id")`);

    await q.query(`
      INSERT INTO "service_order_statuses" ("key","label","color","sort_order","is_final") VALUES
        ('iniciando', 'Iniciando', '#3b82f6', 1, false),
        ('cotando_pecas', 'Cotando peças', '#f59e0b', 2, false),
        ('em_manutencao', 'Realizando manutenção', '#8b5cf6', 3, false),
        ('aguardando_cliente', 'Aguardando cliente', '#eab308', 4, false),
        ('concluida', 'Concluída', '#22c55e', 5, true),
        ('cancelada', 'Cancelada', '#ef4444', 6, true)
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "service_order_events"`);
    await q.query(`DROP TABLE IF EXISTS "service_order_attachments"`);
    await q.query(`DROP TABLE IF EXISTS "service_orders"`);
    await q.query(`DROP TABLE IF EXISTS "service_order_statuses"`);
  }
}
