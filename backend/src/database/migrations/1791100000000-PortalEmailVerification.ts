import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortalEmailVerification1791100000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS verification_code_hash varchar(64)`);
    await q.query(`ALTER TABLE portal_users ADD COLUMN IF NOT EXISTS verification_expires_at timestamp`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE portal_users DROP COLUMN IF EXISTS verification_expires_at`);
    await q.query(`ALTER TABLE portal_users DROP COLUMN IF EXISTS verification_code_hash`);
  }
}
