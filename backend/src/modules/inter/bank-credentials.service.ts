import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { TenantBankConfig } from './entities/tenant-bank-config.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { decryptField, encryptField, isEncryptedField, maskSecret, requireEncryptionSecret } from '../../common/security/field-encryption';

export interface InterCredentials {
  environment: 'sandbox' | 'production';
  clientId: string;
  clientSecret: string;
  cert: Buffer;
  key: Buffer;
  pixKey: string;
  source: 'tenant' | 'env';
}

const isMasked = (value: unknown) => typeof value === 'string' && /^\*+$/.test(value);

@Injectable()
export class BankCredentialsService {
  private readonly logger = new Logger(BankCredentialsService.name);
  private readonly credentialKey = requireEncryptionSecret('CREDENTIAL_ENCRYPTION_KEY');
  private readonly previousCredentialKey = process.env.CREDENTIAL_ENCRYPTION_KEY_PREVIOUS || '';

  // Certificado/chave lidos do disco (fallback global) só precisam ser lidos uma vez.
  private envCertCache: { cert: Buffer; key: Buffer } | null | undefined;

  constructor(
    @InjectRepository(TenantBankConfig) private readonly repo: Repository<TenantBankConfig>,
    private readonly tenantContext: TenantContextService,
  ) {}

  private getEnvCert(): { cert: Buffer; key: Buffer } | null {
    if (this.envCertCache !== undefined) return this.envCertCache;
    try {
      const certPath = path.resolve(process.env.INTER_CERT_PATH || './certs/inter.crt');
      const keyPath = path.resolve(process.env.INTER_KEY_PATH || './certs/inter.key');
      this.envCertCache = { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) };
    } catch (e: any) {
      this.logger.warn('Certificado Inter (env global) nao encontrado: ' + e.message);
      this.envCertCache = null;
    }
    return this.envCertCache;
  }

  private async getRow(tenantId: string | null): Promise<TenantBankConfig | null> {
    if (!tenantId) return null;
    const row = await this.repo.findOne({ where: { tenantId, active: true } });
    return row || null;
  }

  // Resolve as credenciais efetivas para o tenant do contexto atual (ou o informado explicitamente
  // — usado pela conciliação em lote, que roda fora de uma requisição HTTP). Sem linha cadastrada
  // para o tenant, cai integralmente para as variáveis de ambiente globais (comportamento idêntico
  // ao de antes desta refatoração) — é isso que mantém o tenant legado funcionando sem migração.
  async getEffectiveCredentials(tenantId?: string | null): Promise<InterCredentials> {
    const resolvedTenantId = tenantId !== undefined ? tenantId : this.tenantContext.getTenantId();
    const row = await this.getRow(resolvedTenantId);

    if (row && row.clientId && row.clientSecret && row.certificate && row.privateKey) {
      const clientId = isEncryptedField(row.clientId) ? decryptField(row.clientId, [this.credentialKey, this.previousCredentialKey]) : row.clientId;
      const clientSecret = isEncryptedField(row.clientSecret) ? decryptField(row.clientSecret, [this.credentialKey, this.previousCredentialKey]) : row.clientSecret;
      const certificate = isEncryptedField(row.certificate) ? decryptField(row.certificate, [this.credentialKey, this.previousCredentialKey]) : row.certificate;
      const privateKey = isEncryptedField(row.privateKey) ? decryptField(row.privateKey, [this.credentialKey, this.previousCredentialKey]) : row.privateKey;
      return {
        environment: row.environment,
        clientId,
        clientSecret,
        cert: Buffer.from(certificate, 'utf-8'),
        key: Buffer.from(privateKey, 'utf-8'),
        pixKey: row.pixKey || '',
        source: 'tenant',
      };
    }

    const envCert = this.getEnvCert();
    if (!envCert || !process.env.INTER_CLIENT_ID || !process.env.INTER_CLIENT_SECRET) {
      throw new BadRequestException('Integração com o Banco Inter não configurada para este cliente. Acesse Financeiro > Banco Inter e cadastre as credenciais.');
    }
    return {
      environment: (process.env.INTER_ENVIRONMENT === 'production' ? 'production' : 'sandbox'),
      clientId: process.env.INTER_CLIENT_ID,
      clientSecret: process.env.INTER_CLIENT_SECRET,
      cert: envCert.cert,
      key: envCert.key,
      pixKey: process.env.INTER_ACCOUNT || '',
      source: 'env',
    };
  }

  // Config exposta para a tela do tenant — segredos sempre mascarados, nunca retornam em texto puro.
  async getPublicConfig(tenantId: string): Promise<any> {
    const row = await this.repo.findOne({ where: { tenantId } });
    const envCert = this.getEnvCert();
    const hasEnvDefaults = Boolean(envCert && process.env.INTER_CLIENT_ID && process.env.INTER_CLIENT_SECRET);
    if (!row) {
      return { configured: false, environment: 'sandbox', bankId: null, account: null, pixKey: null, clientId: null, hasCertificate: false, active: false, hasEnvDefaults };
    }
    return {
      configured: true,
      environment: row.environment,
      bankId: row.bankId,
      account: row.account,
      pixKey: row.pixKey,
      clientId: row.clientId ? maskSecret('x') : null,
      hasCertificate: Boolean(row.certificate && row.privateKey),
      active: row.active,
      hasEnvDefaults,
    };
  }

  async updateConfig(tenantId: string, dto: any): Promise<any> {
    let row = await this.repo.findOne({ where: { tenantId } });
    if (!row) row = this.repo.create({ tenantId });

    if (dto.bankId !== undefined) row.bankId = dto.bankId || null;
    if (dto.environment !== undefined) row.environment = dto.environment === 'production' ? 'production' : 'sandbox';
    if (dto.account !== undefined) row.account = dto.account || null;
    if (dto.pixKey !== undefined) row.pixKey = dto.pixKey || null;
    if (dto.active !== undefined) row.active = Boolean(dto.active);
    if (dto.clientId !== undefined && dto.clientId && !isMasked(dto.clientId)) row.clientId = encryptField(dto.clientId, this.credentialKey);
    if (dto.clientSecret !== undefined && dto.clientSecret && !isMasked(dto.clientSecret)) row.clientSecret = encryptField(dto.clientSecret, this.credentialKey);
    if (dto.certificate !== undefined && dto.certificate && !isMasked(dto.certificate)) row.certificate = encryptField(dto.certificate, this.credentialKey);
    if (dto.privateKey !== undefined && dto.privateKey && !isMasked(dto.privateKey)) row.privateKey = encryptField(dto.privateKey, this.credentialKey);

    await this.repo.save(row);
    return this.getPublicConfig(tenantId);
  }
}
