import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthenticationHardening1788000000000 implements MigrationInterface {
  name = 'AuthenticationHardening1788000000000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "failed_login_attempts" integer NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locked_until" timestamp NULL`);
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp NULL`);
    await q.query(`DELETE FROM "password_resets"`);
    await q.query(`ALTER TABLE "password_resets" DROP COLUMN IF EXISTS "token"`);
    await q.query(`ALTER TABLE "password_resets" ADD COLUMN IF NOT EXISTS "token_hash" varchar(64) NOT NULL`);
    await q.query(`ALTER TABLE "password_resets" ADD COLUMN IF NOT EXISTS "used_at" timestamp NULL`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_password_resets_token_hash" ON "password_resets" ("token_hash")`);
    await q.query(`CREATE TABLE IF NOT EXISTS "auth_sessions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "device_name" varchar(255), "user_agent" text, "ip_address" varchar(64), "last_seen_at" timestamp NOT NULL, "expires_at" timestamp NOT NULL, "revoked_at" timestamp, "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now(), CONSTRAINT "PK_auth_sessions" PRIMARY KEY ("id"), CONSTRAINT "FK_auth_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE)`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_auth_sessions_user_id" ON "auth_sessions" ("user_id")`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "auth_sessions"`);
    await q.query(`ALTER TABLE "password_resets" ADD COLUMN IF NOT EXISTS "token" varchar(255)`);
    await q.query(`ALTER TABLE "password_resets" DROP COLUMN IF EXISTS "used_at"`);
    await q.query(`ALTER TABLE "password_resets" DROP COLUMN IF EXISTS "token_hash"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "last_login_at"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "locked_until"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "failed_login_attempts"`);
  }
}
