import { MigrationInterface, QueryRunner } from 'typeorm';

export class SuperAdminLoginCode1793900000000 implements MigrationInterface {
  name = 'SuperAdminLoginCode1793900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS super_admin_login_codes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        super_admin_id uuid NOT NULL REFERENCES super_admins(id) ON DELETE CASCADE,
        code_hash varchar(64) NOT NULL,
        expires_at timestamp NOT NULL,
        used boolean NOT NULL DEFAULT false,
        attempts integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_super_admin_login_codes_admin ON super_admin_login_codes(super_admin_id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS super_admin_login_codes`);
  }
}
