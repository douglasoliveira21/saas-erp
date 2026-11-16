import { MigrationInterface, QueryRunner } from 'typeorm';

export class BancoBrasilIntegration1794900000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE bb_bank_configs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      current boolean NOT NULL DEFAULT true, active boolean NOT NULL DEFAULT false,
      environment varchar NOT NULL DEFAULT 'sandbox', settings jsonb NOT NULL DEFAULT '{}',
      credentials text NOT NULL, created_at timestamp NOT NULL DEFAULT now()
    )`);
    await runner.query('CREATE UNIQUE INDEX bb_bank_configs_current ON bb_bank_configs(tenant_id) WHERE current=true');
    await runner.query('CREATE SEQUENCE bb_charge_number_seq MINVALUE 1 MAXVALUE 9999999999 NO CYCLE');
    await runner.query(`CREATE TABLE bb_charges (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      config_id uuid NOT NULL REFERENCES bb_bank_configs(id), kind varchar NOT NULL,
      external_id varchar NOT NULL, request_key varchar NOT NULL, payload jsonb NOT NULL,
      response jsonb NOT NULL DEFAULT '{}', state varchar NOT NULL DEFAULT 'novo',
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, kind, request_key)
    )`);
    await runner.query(`UPDATE banks SET has_integration=true, provider='bb', status='em_teste',
      notes='Boleto e Pix por tenant. Homologar com a conta beneficiária antes de utilizar em produção.'
      WHERE code='001'`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP TABLE bb_charges');
    await runner.query('DROP SEQUENCE bb_charge_number_seq');
    await runner.query('DROP TABLE bb_bank_configs');
    await runner.query("UPDATE banks SET has_integration=false, provider=NULL, status='nao_suportado' WHERE code='001'");
  }
}
