import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { env, validateProductionSecrets } from './config/env.config';

async function bootstrap() {
  validateProductionSecrets();
  const app = await NestFactory.create(AppModule);

  // Run pending schema migrations (add missing columns)
  try {
    const ds = app.get(DataSource);
    await ds.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS city_code VARCHAR(10)`).catch(() => {});
    await ds.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS issue_day INT DEFAULT 3`).catch(() => {});
    await ds.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS iss_retido BOOLEAN DEFAULT FALSE`).catch(() => {});
    await ds.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS iss_aliquota DECIMAL(5,2) DEFAULT 5.00`).catch(() => {});
    await ds.query(`ALTER TABLE financial_movements ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE`).catch(() => {});
    await ds.query(`ALTER TABLE financial_movements ADD COLUMN IF NOT EXISTS recurring_group_id VARCHAR(100)`).catch(() => {});
    await ds.query(`ALTER TABLE financial_movements ADD COLUMN IF NOT EXISTS bill_id UUID`).catch(() => {});
    await ds.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS due_date DATE`).catch(() => {});
    await ds.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS multa_percentage DECIMAL(5,2) DEFAULT 2.00`).catch(() => {});
    await ds.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS mora_percentage DECIMAL(5,2) DEFAULT 0.03`).catch(() => {});
    await ds.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS purchase_id UUID`).catch(() => {});
    await ds.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS bill_group_id VARCHAR(100)`).catch(() => {});
    await ds.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS origin VARCHAR(20) DEFAULT 'manual'`).catch(() => {});
    await ds.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS registration_status VARCHAR(20) DEFAULT 'completo'`).catch(() => {});
    await ds.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS financial_status VARCHAR(20)`).catch(() => {});
    await ds.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS financial_total DECIMAL(10,2)`).catch(() => {});
    await ds.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS financial_generated_at TIMESTAMP`).catch(() => {});
    await ds.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS financial_generated_by UUID`).catch(() => {});
    await ds.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS financial_adjustment_type VARCHAR(30)`).catch(() => {});
    await ds.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS financial_adjustment_reason TEXT`).catch(() => {});
    // bill_allocations table
    await ds.query(`
      CREATE TABLE IF NOT EXISTS bill_allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
        cost_center_id UUID REFERENCES cost_centers(id),
        chart_account_id UUID,
        contract_id UUID,
        percentage DECIMAL(5,2) NOT NULL,
        value DECIMAL(10,2) NOT NULL,
        created_by UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});
    // Unique constraint for idempotency. Logged (not silently swallowed) because
    // purchases.service.ts relies on this index actually existing to prevent duplicate bills —
    // the exact same silent-failure pattern found in idx_contract_billings_period below bit us
    // once already; if this ever fails (e.g. pre-existing duplicate bills), we want to know.
    await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_purchase_installment ON bills(purchase_id, installment_number) WHERE purchase_id IS NOT NULL`).catch((e) => console.warn('idx_bills_purchase_installment warning:', e.message));
    // contract_billings unique constraint + updated_at column
    await ds.query(`ALTER TABLE contract_billings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`).catch(() => {});
    // Sem constraint única desde sempre, contract_billings acumulou linhas duplicadas por
    // (contract_id, billing_period) — o que faz o CREATE UNIQUE INDEX abaixo falhar (violação de
    // unicidade) e ser engolido pelo .catch() a cada boot, silenciosamente, sem nunca aplicar a
    // trava. Mescla os duplicados antes de tentar, preferindo o invoice_id cuja nota esteja
    // 'autorizada' (não apenas o mais recente — uma correção anterior deste mesmo dedupe escolheu
    // "mais recente" e acabou pegando uma NF cancelada em vez da autorizada mais antiga, porque a
    // tentativa de reemissão duplicada aconteceu depois).
    await ds.query(`
      DO $$
      DECLARE has_dupes boolean;
      BEGIN
        SELECT EXISTS (
          SELECT 1 FROM contract_billings GROUP BY contract_id, billing_period HAVING COUNT(*) > 1
        ) INTO has_dupes;
        IF has_dupes THEN
          CREATE TEMP TABLE cb_merge AS
          SELECT
            cb.contract_id,
            cb.billing_period,
            (array_agg(cb.id ORDER BY (i.status = 'autorizada') DESC NULLS LAST, (cb.invoice_id IS NOT NULL) DESC, (cb.boleto_code IS NOT NULL) DESC, cb.created_at DESC))[1] AS keep_id,
            (array_agg(cb.invoice_id ORDER BY (i.status = 'autorizada') DESC NULLS LAST, cb.invoice_id IS NULL, cb.created_at DESC))[1] AS merged_invoice_id,
            (array_agg(cb.boleto_code ORDER BY cb.boleto_code IS NULL, cb.created_at DESC))[1] AS merged_boleto_code
          FROM contract_billings cb
          LEFT JOIN invoices i ON i.id = cb.invoice_id
          GROUP BY cb.contract_id, cb.billing_period;

          UPDATE contract_billings cb
          SET invoice_id = m.merged_invoice_id, boleto_code = m.merged_boleto_code, updated_at = NOW()
          FROM cb_merge m
          WHERE cb.id = m.keep_id;

          DELETE FROM contract_billings cb
          WHERE NOT EXISTS (SELECT 1 FROM cb_merge m WHERE m.keep_id = cb.id);

          DROP TABLE cb_merge;
        END IF;
      END $$;
    `).catch((e) => console.warn('contract_billings dedupe warning:', e.message));
    await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_billings_period ON contract_billings(contract_id, billing_period)`).catch((e) => console.warn('idx_contract_billings_period warning:', e.message));
    // bill_payments table (ensure exists)
    await ds.query(`
      CREATE TABLE IF NOT EXISTS bill_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
        value DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(50),
        idempotency_key VARCHAR(150),
        paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});
  } catch (e) {
    console.warn('Schema migration warning:', e.message);
  }

  // Enable CORS
  const allowedOrigins = String(env.server.corsOrigin || '').split(',').map(item => item.trim()).filter(Boolean);
  app.enableCors({
    origin: allowedOrigins.includes('*') ? true : allowedOrigins,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api');

  const port = env.server.port;
  await app.listen(port);

  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📚 API available at http://localhost:${port}/api`);
}

bootstrap();
