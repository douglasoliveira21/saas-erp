import { MigrationInterface, QueryRunner } from 'typeorm';

export class OperationTrackingCenter1791500000000 implements MigrationInterface {
  name = 'OperationTrackingCenter1791500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS operation_runs (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), module varchar(80) NOT NULL, action varchar(160) NOT NULL,
      title varchar(255) NOT NULL, status varchar(30) NOT NULL DEFAULT 'processando', http_method varchar(10), path text,
      entity_type varchar(80), entity_id varchar(160), user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      message text, error_message text, request_summary jsonb, response_summary jsonb, duration_ms integer,
      ip_address varchar(100), user_agent text, retryable boolean NOT NULL DEFAULT false,
      started_at timestamp NOT NULL DEFAULT NOW(), finished_at timestamp, created_at timestamp NOT NULL DEFAULT NOW()
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_operation_runs_started ON operation_runs(started_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_operation_runs_status ON operation_runs(status,started_at DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_operation_runs_entity ON operation_runs(entity_type,entity_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS operation_runs`);
  }
}