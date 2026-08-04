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
    // Unique constraint for idempotency
    await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_bills_purchase_installment ON bills(purchase_id, installment_number) WHERE purchase_id IS NOT NULL`).catch(() => {});
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
