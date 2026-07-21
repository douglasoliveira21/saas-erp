import { MigrationInterface, QueryRunner } from 'typeorm';

export class OperationalErpControls1782000000000 implements MigrationInterface {
  name = 'OperationalErpControls1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS payments (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), sale_id uuid, customer_id uuid,
      type varchar(20) NOT NULL, codigo_solicitacao varchar(100), status varchar(40) NOT NULL DEFAULT 'pendente',
      value numeric(14,2) NOT NULL DEFAULT 0, customer_name varchar(255), customer_doc varchar(40),
      due_date date, linha_digitavel text, pix_copia_e_cola text, nosso_numero varchar(100),
      paid_at timestamp, inter_payload jsonb, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_codigo_solicitacao ON payments(codigo_solicitacao) WHERE codigo_solicitacao IS NOT NULL`);
    await queryRunner.query(`ALTER TABLE customers ALTER COLUMN cpf_cnpj TYPE varchar(40)`);
    await queryRunner.query(`ALTER TABLE invoices ALTER COLUMN recipient_cnpj TYPE varchar(40)`);
    await queryRunner.query(`ALTER TABLE fiscal_config ALTER COLUMN cnpj TYPE varchar(40)`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS fiscal_tax_parameters (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), category varchar(50) NOT NULL,
      code varchar(30) NOT NULL, description varchar(255) NOT NULL, metadata jsonb,
      active boolean NOT NULL DEFAULT true, created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(), UNIQUE(category, code)
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS fiscal_service_profiles (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), name varchar(120) NOT NULL,
      service_code varchar(30), description text, settings jsonb NOT NULL DEFAULT '{}'::jsonb,
      active boolean NOT NULL DEFAULT true, created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS approval_requests (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), type varchar(50) NOT NULL,
      entity_type varchar(50) NOT NULL, entity_id uuid, amount numeric(14,2), reason text NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'pendente', requested_by uuid,
      first_approved_by uuid, first_approved_at timestamp, second_approved_by uuid,
      second_approved_at timestamp, payload jsonb, created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS collection_cases (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), account_id uuid,
      customer_id uuid, stage varchar(30) NOT NULL DEFAULT 'inadimplente',
      status varchar(20) NOT NULL DEFAULT 'aberto', negotiated_amount numeric(14,2),
      installments integer, next_action_at date, notes text, created_by uuid,
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS fiscal_closings (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), period varchar(7) UNIQUE NOT NULL,
      closed_by uuid, closed_at timestamp NOT NULL DEFAULT now(), notes text,
      created_at timestamp NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS cost_allocations (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), entity_type varchar(50) NOT NULL,
      entity_id uuid NOT NULL, cost_center_id uuid NOT NULL, percentage numeric(7,4),
      amount numeric(14,2), created_by uuid, created_at timestamp NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS cnab_batches (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), bank_account_id uuid,
      direction varchar(20) NOT NULL, layout varchar(20) NOT NULL DEFAULT 'CNAB240',
      status varchar(20) NOT NULL DEFAULT 'recebido', filename varchar(255),
      raw_content text NOT NULL, metadata jsonb, created_by uuid,
      created_at timestamp NOT NULL DEFAULT now(), processed_at timestamp
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS notifications (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), title varchar(160) NOT NULL,
      message text NOT NULL, type varchar(40) NOT NULL DEFAULT 'info', status varchar(20) NOT NULL DEFAULT 'nova',
      user_id uuid, assigned_to uuid, entity_type varchar(50), entity_id uuid,
      read_at timestamp, resolved_at timestamp, created_at timestamp NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS dashboard_preferences (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), user_id uuid UNIQUE NOT NULL,
      widgets jsonb NOT NULL DEFAULT '[]'::jsonb, updated_at timestamp NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`INSERT INTO fiscal_tax_parameters(category, code, description) VALUES
      ('pis_cofins_cst','01','Operacao tributavel com aliquota basica'),
      ('pis_cofins_cst','02','Operacao tributavel com aliquota diferenciada'),
      ('pis_cofins_cst','03','Operacao tributavel por unidade de medida'),
      ('pis_cofins_cst','04','Operacao monofasica com aliquota zero'),
      ('pis_cofins_cst','06','Operacao tributavel com aliquota zero'),
      ('pis_cofins_cst','07','Operacao isenta'),
      ('pis_cofins_cst','08','Operacao sem incidencia'),
      ('pis_cofins_cst','09','Operacao com suspensao')
      ON CONFLICT (category, code) DO NOTHING`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['dashboard_preferences','notifications','cnab_batches','cost_allocations','fiscal_closings','collection_cases','approval_requests','fiscal_service_profiles','fiscal_tax_parameters']) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table}`);
    }
    // Payments is shared operational data and is intentionally preserved on rollback.
  }
}
