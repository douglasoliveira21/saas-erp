import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { env } from './config/env.config';
import { DataSource } from 'typeorm';
import { seedOnStart } from './database/seed-on-start';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: env.server.corsOrigin,
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

  // Executar seed automático após iniciar
  try {
    const dataSource = app.get(DataSource);
    await seedOnStart(dataSource);
  } catch (error) {
    console.warn('⚠️  Seed automático não executado:', error.message);
  }

  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📚 API available at http://localhost:${port}/api`);
}

bootstrap();
