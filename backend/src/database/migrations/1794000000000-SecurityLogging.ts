import { MigrationInterface, QueryRunner } from 'typeorm';

// Bloqueio de IP por tentativas de login (independente da conta) + log de erros de qualquer
// requisição (capturado pelo filtro global de exceções) - as duas peças que faltavam pra dar
// visibilidade completa de segurança/erros do sistema, além do que audit_logs/operation_runs
// já cobriam (eventos de negócio e falhas em operações mutantes rastreadas, respectivamente).
export class SecurityLogging1794000000000 implements MigrationInterface {
  name = 'SecurityLogging1794000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS blocked_ips (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ip varchar(64) NOT NULL UNIQUE,
        failed_attempts integer NOT NULL DEFAULT 0,
        blocked boolean NOT NULL DEFAULT false,
        blocked_at timestamp,
        last_attempt_at timestamp,
        last_email_attempted varchar(255),
        unblocked_at timestamp,
        unblocked_by uuid,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_blocked_ips_blocked ON blocked_ips(blocked)`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS error_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        status_code integer NOT NULL,
        method varchar(10) NOT NULL,
        path varchar(500) NOT NULL,
        message text NOT NULL,
        stack text,
        user_id uuid,
        tenant_id uuid,
        ip_address varchar(64),
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS error_logs`);
    await q.query(`DROP TABLE IF EXISTS blocked_ips`);
  }
}
