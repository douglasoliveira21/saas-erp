import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdvancedErpProductionHardening1780000000000 implements MigrationInterface {
  name = 'AdvancedErpProductionHardening1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions jsonb`);

    await queryRunner.query(`ALTER TABLE financial_movements ADD COLUMN IF NOT EXISTS bank_account_id uuid`);
    await queryRunner.query(`ALTER TABLE financial_movements ADD COLUMN IF NOT EXISTS cost_center_id uuid`);
    await queryRunner.query(`ALTER TABLE financial_movements ADD COLUMN IF NOT EXISTS chart_account_id uuid`);
    await queryRunner.query(`ALTER TABLE financial_movements ADD COLUMN IF NOT EXISTS competence_date date`);
    await queryRunner.query(`ALTER TABLE financial_movements ADD COLUMN IF NOT EXISTS due_date date`);
    await queryRunner.query(`ALTER TABLE financial_movements ADD COLUMN IF NOT EXISTS paid_at timestamp`);
    await queryRunner.query(`ALTER TABLE accounts_receivable ADD COLUMN IF NOT EXISTS competence_date date`);
    await queryRunner.query(`ALTER TABLE accounts_receivable ADD COLUMN IF NOT EXISTS cost_center_id uuid`);
    await queryRunner.query(`ALTER TABLE accounts_receivable ADD COLUMN IF NOT EXISTS chart_account_id uuid`);
    await queryRunner.query(`ALTER TABLE accounts_receivable ADD COLUMN IF NOT EXISTS reversed_at timestamp`);
    await queryRunner.query(`ALTER TABLE accounts_receivable ADD COLUMN IF NOT EXISTS reversal_reason text`);
    await queryRunner.query(`ALTER TABLE installments ADD COLUMN IF NOT EXISTS competence_date date`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS cost_centers (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      code varchar(50) UNIQUE NOT NULL,
      name varchar(255) NOT NULL,
      description text,
      active boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS chart_accounts (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      code varchar(50) UNIQUE NOT NULL,
      name varchar(255) NOT NULL,
      type varchar(20) NOT NULL,
      parent_id uuid,
      active boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS bank_accounts (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      name varchar(120) NOT NULL,
      type varchar(20) NOT NULL DEFAULT 'banco',
      bank_name varchar(120),
      agency varchar(30),
      account varchar(40),
      opening_balance numeric(12,2) NOT NULL DEFAULT 0,
      active boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS monthly_closings (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      period varchar(7) UNIQUE NOT NULL,
      closed_by uuid,
      closed_at timestamp NOT NULL,
      notes text,
      created_at timestamp NOT NULL DEFAULT now()
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS installment_payments (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      installment_id uuid NOT NULL,
      movement_id uuid,
      value numeric(10,2) NOT NULL,
      payment_method varchar(50) NOT NULL,
      bank_account_id uuid,
      paid_at timestamp NOT NULL,
      observations text,
      created_by uuid,
      created_at timestamp NOT NULL DEFAULT now()
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS accounts_payable (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      purchase_id uuid,
      supplier_id uuid,
      supplier_name varchar(255),
      description varchar(255) NOT NULL,
      total_value numeric(12,2) NOT NULL,
      paid_value numeric(12,2) NOT NULL DEFAULT 0,
      pending_value numeric(12,2) NOT NULL,
      competence_date date,
      due_date date,
      payment_method varchar(50),
      paid_at timestamp,
      status varchar(20) NOT NULL DEFAULT 'pendente',
      cost_center_id uuid,
      chart_account_id uuid,
      created_by uuid,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`);

    await queryRunner.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_quantity integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS average_cost numeric(12,4) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS controls_lot boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS controls_serial boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS unit_cost numeric(12,4)`);
    await queryRunner.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS lot_number varchar(100)`);
    await queryRunner.query(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS serial_number varchar(100)`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS stock_inventories (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      product_id uuid NOT NULL,
      counted_quantity integer NOT NULL,
      system_quantity integer NOT NULL,
      difference integer NOT NULL,
      justification text NOT NULL,
      created_by uuid,
      created_at timestamp NOT NULL DEFAULT now()
    )`);

    await queryRunner.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS supplier_id uuid`);
    await queryRunner.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS cost_center_id uuid`);
    await queryRunner.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS chart_account_id uuid`);
    await queryRunner.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS competence_date date`);
    await queryRunner.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS selected_quote_id uuid`);
    await queryRunner.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS approval_limit numeric(12,2) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS partially_received boolean NOT NULL DEFAULT false`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS purchase_items (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      purchase_id uuid NOT NULL,
      product_id uuid,
      description varchar(255) NOT NULL,
      quantity numeric(10,2) NOT NULL,
      received_quantity numeric(10,2) NOT NULL DEFAULT 0,
      unit_price numeric(12,2) NOT NULL DEFAULT 0,
      total_value numeric(12,2) NOT NULL DEFAULT 0
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS purchase_quotes (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      purchase_id uuid NOT NULL,
      supplier_id uuid,
      supplier_name varchar(255) NOT NULL,
      supplier_cnpj varchar(20),
      total_value numeric(12,2) NOT NULL DEFAULT 0,
      delivery_days integer,
      payment_terms varchar(255),
      status varchar(20) NOT NULL DEFAULT 'recebida',
      observations text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS purchase_attachments (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      purchase_id uuid NOT NULL,
      filename varchar(255) NOT NULL,
      type varchar(20) NOT NULL,
      mime_type varchar(120),
      storage_path text NOT NULL,
      uploaded_by uuid,
      created_at timestamp NOT NULL DEFAULT now()
    )`);

    await queryRunner.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_approved_by uuid`);
    await queryRunner.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS commercial_approved_by uuid`);
    await queryRunner.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS financial_approved_by uuid`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS sale_events (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      sale_id uuid NOT NULL,
      type varchar(80) NOT NULL,
      status varchar(80),
      description text,
      metadata jsonb,
      created_by uuid,
      created_at timestamp NOT NULL DEFAULT now()
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS sale_attachments (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      sale_id uuid NOT NULL,
      filename varchar(255) NOT NULL,
      type varchar(50) NOT NULL DEFAULT 'outro',
      mime_type varchar(120),
      storage_path text NOT NULL,
      uploaded_by uuid,
      created_at timestamp NOT NULL DEFAULT now()
    )`);

    await queryRunner.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS queue_status varchar(20) NOT NULL DEFAULT 'pendente'`);
    await queryRunner.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS next_retry_at timestamp`);
    await queryRunner.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS xml_storage_path text`);
    await queryRunner.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS correction_letter text`);
    await queryRunner.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS correction_protocol varchar(80)`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS fiscal_events (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      invoice_id uuid,
      type varchar(80) NOT NULL,
      status varchar(30),
      message text,
      payload jsonb,
      created_by uuid,
      created_at timestamp NOT NULL DEFAULT now()
    )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS fiscal_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS sale_attachments`);
    await queryRunner.query(`DROP TABLE IF EXISTS sale_events`);
    await queryRunner.query(`DROP TABLE IF EXISTS purchase_attachments`);
    await queryRunner.query(`DROP TABLE IF EXISTS purchase_quotes`);
    await queryRunner.query(`DROP TABLE IF EXISTS purchase_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS stock_inventories`);
    await queryRunner.query(`DROP TABLE IF EXISTS accounts_payable`);
    await queryRunner.query(`DROP TABLE IF EXISTS installment_payments`);
    await queryRunner.query(`DROP TABLE IF EXISTS monthly_closings`);
    await queryRunner.query(`DROP TABLE IF EXISTS bank_accounts`);
    await queryRunner.query(`DROP TABLE IF EXISTS chart_accounts`);
    await queryRunner.query(`DROP TABLE IF EXISTS cost_centers`);
  }
}
