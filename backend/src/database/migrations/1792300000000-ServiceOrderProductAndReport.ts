import { MigrationInterface, QueryRunner } from 'typeorm';

export class ServiceOrderProductAndReport1792300000000 implements MigrationInterface {
  name = 'ServiceOrderProductAndReport1792300000000';

  async up(q: QueryRunner): Promise<void> {
    // "description" passa a ser o relato do cliente (o que ele reclama/pede) — diagnóstico e
    // observações são etapas distintas do fluxo de uma OS de assistência técnica.
    await q.query(`ALTER TABLE "service_orders" RENAME COLUMN "description" TO "customer_report"`);
    await q.query(`ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "diagnosis" text`);
    await q.query(`ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "observations" text`);
    await q.query(`ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "equipment" varchar(120)`);
    await q.query(`ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "brand" varchar(80)`);
    await q.query(`ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "model" varchar(80)`);
    await q.query(`ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "serial_number" varchar(80)`);
    await q.query(`ALTER TABLE "service_orders" ADD COLUMN IF NOT EXISTS "accessories" text`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "service_orders" DROP COLUMN IF EXISTS "accessories"`);
    await q.query(`ALTER TABLE "service_orders" DROP COLUMN IF EXISTS "serial_number"`);
    await q.query(`ALTER TABLE "service_orders" DROP COLUMN IF EXISTS "model"`);
    await q.query(`ALTER TABLE "service_orders" DROP COLUMN IF EXISTS "brand"`);
    await q.query(`ALTER TABLE "service_orders" DROP COLUMN IF EXISTS "equipment"`);
    await q.query(`ALTER TABLE "service_orders" DROP COLUMN IF EXISTS "observations"`);
    await q.query(`ALTER TABLE "service_orders" DROP COLUMN IF EXISTS "diagnosis"`);
    await q.query(`ALTER TABLE "service_orders" RENAME COLUMN "customer_report" TO "description"`);
  }
}
