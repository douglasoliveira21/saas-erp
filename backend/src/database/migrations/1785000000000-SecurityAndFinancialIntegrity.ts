import { MigrationInterface, QueryRunner } from 'typeorm';

export class SecurityAndFinancialIntegrity1785000000000 implements MigrationInterface {
  name = 'SecurityAndFinancialIntegrity1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await queryRunner.query(`ALTER TABLE glpi_config ALTER COLUMN app_token TYPE text`);
    await queryRunner.query(`ALTER TABLE glpi_config ALTER COLUMN user_token TYPE text`);
    await queryRunner.query(`UPDATE glpi_config SET session_token = NULL`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inter_webhook_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_hash varchar(64) NOT NULL,
        source_ip varchar(45),
        status varchar(20) NOT NULL DEFAULT 'recebido',
        payload jsonb NOT NULL,
        error text,
        processed_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_inter_webhook_events_hash
      ON inter_webhook_events(event_hash)
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT sale_id FROM accounts_receivable
          WHERE sale_id IS NOT NULL
          GROUP BY sale_id HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'Existem contas a receber duplicadas por venda; reconcilie antes de aplicar a restricao unica';
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_receivable_sale_unique
      ON accounts_receivable(sale_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_accounts_receivable_sale_unique`);
    await queryRunner.query(`DROP TABLE IF EXISTS inter_webhook_events`);
  }
}
