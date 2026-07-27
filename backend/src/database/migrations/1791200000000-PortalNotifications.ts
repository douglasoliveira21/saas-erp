import { MigrationInterface, QueryRunner } from 'typeorm';

export class PortalNotifications1791200000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS portal_push_subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), portal_user_id uuid NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
      endpoint text NOT NULL UNIQUE, p256dh text NOT NULL, auth text NOT NULL, created_at timestamp NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE TABLE IF NOT EXISTS portal_notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), portal_user_id uuid NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
      type varchar(30) NOT NULL, title varchar(180) NOT NULL, body text NOT NULL, url text,
      dedupe_key varchar(255) NOT NULL, read_at timestamp, created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT uq_portal_notification UNIQUE(portal_user_id,dedupe_key)
    )`);
    await q.query(`CREATE TABLE IF NOT EXISTS portal_ticket_notification_state (
      glpi_ticket_id integer PRIMARY KEY, status integer, last_followup_id integer, checked_at timestamp NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_portal_notifications_user ON portal_notifications(portal_user_id,created_at DESC)`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS portal_ticket_notification_state');
    await q.query('DROP TABLE IF EXISTS portal_notifications');
    await q.query('DROP TABLE IF EXISTS portal_push_subscriptions');
  }
}
