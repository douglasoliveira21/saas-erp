import * as dotenv from 'dotenv';
import * as path from 'path';

// Carregar variáveis de ambiente (em Docker, já vêm do environment)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT) || 5432,
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    database: process.env.DATABASE_NAME || 'gestao_ti',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  server: {
    port: parseInt(process.env.PORT) || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || '*',
  },
  inter: {
    clientId: process.env.INTER_CLIENT_ID || '',
    clientSecret: process.env.INTER_CLIENT_SECRET || '',
    certPath: process.env.INTER_CERT_PATH || './certs/inter.crt',
    keyPath: process.env.INTER_KEY_PATH || './certs/inter.key',
    environment: process.env.INTER_ENVIRONMENT || 'sandbox',
    account: process.env.INTER_ACCOUNT || '',
  },
  evolution: {
    apiUrl: process.env.EVOLUTION_API_URL || '',
    apiKey: process.env.EVOLUTION_API_KEY || '',
  },
};

const unsafeSecrets = new Set([
  'secret-key-change-in-production', 'change-me', 'changeme',
  'uma-chave-forte-para-certificados', 'uma-chave-forte-para-tokens',
  'uma-chave-forte-para-o-banco-inter',
]);

export function validateProductionSecrets(): void {
  // Só pula a validação quando NODE_ENV está explicitamente configurado como development/test.
  // Um deploy que esqueça de definir NODE_ENV cairia no default 'development' do env.config e
  // subiria em produção com JWT_SECRET fraco e CORS liberado sem nenhum aviso — por isso tratamos
  // "não configurado" (ou qualquer valor inesperado) como produção para fins de validação de segredos.
  const rawNodeEnv = (process.env.NODE_ENV || '').trim().toLowerCase();
  const isExplicitlyDev = rawNodeEnv === 'development' || rawNodeEnv === 'test';
  if (isExplicitlyDev) return;
  const required = ['JWT_SECRET', 'CERT_ENCRYPTION_KEY', 'CREDENTIAL_ENCRYPTION_KEY', 'INTER_WEBHOOK_SECRET'];
  const invalid = required.filter((name) => {
    const value = (process.env[name] || '').trim();
    return value.length < 32 || unsafeSecrets.has(value.toLowerCase());
  });
  if (invalid.length) {
    throw new Error(`Inicialização recusada: configure segredos fortes (mínimo 32 caracteres) em: ${invalid.join(', ')}`);
  }
}
