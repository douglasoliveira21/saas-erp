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
    await ds.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS due_date DATE`).catch(() => {});
    await ds.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS multa_percentage DECIMAL(5,2) DEFAULT 2.00`).catch(() => {});
    await ds.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS mora_percentage DECIMAL(5,2) DEFAULT 0.03`).catch(() => {});
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
