import * as crypto from 'crypto';

const PREFIX = 'enc:v1';

function keyFrom(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

export function requireEncryptionSecret(name: string): string {
  const secret = process.env[name]?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} deve ser configurada em producao`);
  }
  return `development-only-${name}`;
}

export function encryptField(value: string, secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyFrom(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

export function decryptField(value: string, secrets: string[]): string {
  if (!value?.startsWith(`${PREFIX}:`)) return value;
  const [, , ivValue, tagValue, encryptedValue] = value.split(':');
  for (const secret of secrets.filter(Boolean)) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', keyFrom(secret), Buffer.from(ivValue, 'base64'));
      decipher.setAuthTag(Buffer.from(tagValue, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // Try the previous key during key rotation.
    }
  }
  throw new Error('Nao foi possivel descriptografar o campo protegido');
}

export function isEncryptedField(value?: string | null): boolean {
  return Boolean(value?.startsWith(`${PREFIX}:`));
}

export function maskSecret(value?: string | null): string | null {
  if (!value) return null;
  return '********';
}
