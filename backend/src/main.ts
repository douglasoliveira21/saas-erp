import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { env, validateProductionSecrets } from './config/env.config';

async function bootstrap() {
  validateProductionSecrets();
  const app = await NestFactory.create(AppModule);

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
