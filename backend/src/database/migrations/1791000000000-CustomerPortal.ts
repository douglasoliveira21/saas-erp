import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerPortal1791000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS portal_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES customers(id),
      name varchar(180) NOT NULL, email varchar(255) NOT NULL UNIQUE, password varchar(255) NOT NULL,
      phone varchar(30), department varchar(80), role varchar(20) NOT NULL DEFAULT 'user',
      status varchar(20) NOT NULL DEFAULT 'pending', glpi_user_id integer, approved_at timestamp,
      approved_by uuid, last_login_at timestamp, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT chk_portal_role CHECK(role IN ('admin','manager','finance','user')),
      CONSTRAINT chk_portal_status CHECK(status IN ('pending','active','blocked'))
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_portal_users_customer ON portal_users(customer_id)`);
    await q.query(`CREATE TABLE IF NOT EXISTS portal_ticket_forms (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(100) NOT NULL DEFAULT 'Formulário padrão',
      active boolean NOT NULL DEFAULT true, customer_id uuid REFERENCES customers(id), fields jsonb NOT NULL DEFAULT '[]',
      updated_at timestamp NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE TABLE IF NOT EXISTS portal_tickets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES customers(id),
      portal_user_id uuid NOT NULL REFERENCES portal_users(id), glpi_ticket_id integer NOT NULL UNIQUE,
      glpi_entity_id integer NOT NULL, title varchar(500) NOT NULL, description text NOT NULL,
      type integer NOT NULL DEFAULT 1, urgency integer NOT NULL DEFAULT 3, status integer NOT NULL DEFAULT 1,
      form_data jsonb NOT NULL DEFAULT '{}', created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_portal_tickets_scope ON portal_tickets(customer_id,portal_user_id)`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS portal_tickets');
    await q.query('DROP TABLE IF EXISTS portal_ticket_forms');
    await q.query('DROP TABLE IF EXISTS portal_users');
  }
}
