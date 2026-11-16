import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { createPrivateKey, X509Certificate } from 'crypto';
import * as tls from 'tls';
import * as forge from 'node-forge';
import { Tenant } from '../platform/entities/tenant.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { decryptField, encryptField, requireEncryptionSecret } from '../../common/security/field-encryption';
import { BbBankConfig } from './entities/bb-bank-config.entity';

export const BB_SETTINGS = ['agency', 'account', 'agreement', 'wallet', 'variation', 'modality',
  'pixKey', 'beneficiaryName', 'beneficiaryDocument', 'beneficiaryAddress', 'bolepix'];

@Injectable()
export class BbConfigService {
  private readonly encryptionKey = requireEncryptionSecret('CREDENTIAL_ENCRYPTION_KEY');
  constructor(
    @InjectRepository(BbBankConfig) private readonly configs: Repository<BbBankConfig>,
    private readonly source: DataSource,
    private readonly context: TenantContextService,
  ) {}

  async isSelected(): Promise<boolean> {
    const id = this.context.getTenantId();
    if (!id) return false;
    const tenant = await this.source.getRepository(Tenant).findOne({ where: { id }, relations: ['bank'] });
    if (!tenant) throw new NotFoundException('Empresa não encontrada.');
    if (!tenant.bank) return false;
    if (tenant.bank.code === '001' || tenant.bank.provider === 'bb') return true;
    if (tenant.bank.provider !== 'inter' && tenant.bank.code !== '077') {
      throw new BadRequestException('O banco selecionado para esta empresa ainda não possui integração de cobrança.');
    }
    return false;
  }

  private decrypt(row: BbBankConfig) {
    return JSON.parse(decryptField(row.credentials, [this.encryptionKey, process.env.CREDENTIAL_ENCRYPTION_KEY_PREVIOUS || '']));
  }

  async resolve(id?: string, allowInactive = false) {
    const tenantId = this.context.requireTenantId();
    const row = await this.configs.findOne({ where: id ? { id, tenantId } : { tenantId, current: true } });
    if (!row || (!id && !allowInactive && !row.active)) {
      throw new BadRequestException('Configure e ative o Banco do Brasil nesta empresa antes de emitir.');
    }
    const secrets = this.decrypt(row);
    return { row, secrets };
  }

  async publicConfig() {
    const tenantId = this.context.requireTenantId();
    const row = await this.configs.findOne({ where: { tenantId, current: true } });
    if (!row) return { configured: false, environment: 'sandbox', active: false, settings: {} };
    const secrets = this.decrypt(row);
    return { configured: true, environment: row.environment, active: row.active, settings: row.settings,
      hasClientId: Boolean(secrets.clientId), hasClientSecret: Boolean(secrets.clientSecret),
      hasAppKey: Boolean(secrets.appKey), hasCertificate: Boolean(secrets.certificate && secrets.privateKey),
      certificateExpiresAt: secrets.certificate ? new X509Certificate(secrets.certificate).validTo : null };
  }

  async save(dto: any) {
    if (!dto || typeof dto !== 'object' || Array.isArray(dto)) throw new BadRequestException('Configuração inválida.');
    await this.source.transaction(async manager => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['bb-config:' + this.context.requireTenantId()]);
      await this.saveLocked(dto, manager);
    });
    return this.publicConfig();
  }

  private async saveLocked(dto: any, manager: EntityManager) {
    const tenantId = this.context.requireTenantId();
    const old = await manager.getRepository(BbBankConfig).findOne({ where: { tenantId, current: true } });
    const secrets = old ? this.decrypt(old) : {};
    const settings = { ...(old?.settings || {}) };
    for (const field of BB_SETTINGS) if (dto.settings?.[field] !== undefined) {
      if (field === 'bolepix') {
        if (typeof dto.settings[field] !== 'boolean') throw new BadRequestException('Opção BolePix inválida.');
      } else if (typeof dto.settings[field] !== 'string' || dto.settings[field].length > 500) throw new BadRequestException('Campo bancário inválido: ' + field);
      settings[field] = typeof dto.settings[field] === 'string' ? dto.settings[field].trim() : dto.settings[field];
    }
    for (const field of ['clientId', 'clientSecret', 'appKey', 'certificate', 'privateKey']) {
      const value = dto[field];
      if (value !== undefined && (typeof value !== 'string' || value.length > 100_000)) throw new BadRequestException('Credencial bancária inválida.');
      if (typeof value === 'string' && value.trim() && !/^\*+$/.test(value.trim())) secrets[field] = value.trim();
    }
    if (dto.pfxBase64) {
      if (typeof dto.pfxBase64 !== 'string' || dto.pfxBase64.length > 3_000_000) throw new BadRequestException('Arquivo A1 inválido ou maior que 2 MB.');
      try {
        const pfx = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.decode64(dto.pfxBase64)), false, dto.pfxPassword || '');
        const certs = pfx.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
        const keys = [
          ...(pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
          ...(pfx.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []),
        ];
        const key = keys.find(bag => bag.key)?.key;
        if (!key) throw new Error('Chave ausente');
        const matching = certs.find(bag => bag.cert &&
          new X509Certificate(forge.pki.certificateToPem(bag.cert)).checkPrivateKey(createPrivateKey(forge.pki.privateKeyToPem(key))));
        if (!matching?.cert) throw new Error('Certificado sem par');
        secrets.privateKey = forge.pki.privateKeyToPem(key);
        secrets.certificate = [matching, ...certs.filter(bag => bag !== matching && bag.cert)]
          .map(bag => forge.pki.certificateToPem(bag.cert)).join('\n');
      } catch {
        throw new BadRequestException('Não foi possível abrir o A1. Confira o arquivo PFX/P12 e sua senha.');
      }
    }
    if (!secrets.clientId || !secrets.clientSecret || !secrets.appKey) {
      throw new BadRequestException('Informe Client ID, Client Secret e App Key.');
    }
    if (secrets.certificate || secrets.privateKey) {
      try {
        secrets.certificate = secrets.certificate.replace(/\\n/g, '\n');
        secrets.privateKey = secrets.privateKey.replace(/\\n/g, '\n');
        const cert = new X509Certificate(secrets.certificate);
        if (!cert.checkPrivateKey(createPrivateKey(secrets.privateKey))) throw new Error('Chave incompatível');
        if (Date.parse(cert.validTo) <= Date.now() || Date.parse(cert.validFrom) > Date.now()) throw new Error('Validade');
        tls.createSecureContext({ cert: secrets.certificate, key: secrets.privateKey });
      } catch { throw new BadRequestException('Certificado ou chave inválidos, incompatíveis ou fora da validade. Use o certificado da empresa e sua chave privada.'); }
    }
    for (const [field, length] of [['agreement', 7], ['wallet', 2], ['variation', 3]] as const) {
      if (settings[field] && !new RegExp('^\\d{1,' + length + '}$').test(String(settings[field]))) {
        throw new BadRequestException('Convênio, carteira ou variação inválidos.');
      }
    }
    const environment = dto.environment ?? old?.environment ?? 'sandbox';
    if (!['sandbox', 'production'].includes(environment)) throw new BadRequestException('Ambiente inválido.');
    await manager.update(BbBankConfig, { tenantId, current: true }, { current: false });
    await manager.save(BbBankConfig, manager.create(BbBankConfig, {
      tenantId, current: true, active: dto.active === undefined ? (old?.active || false) : dto.active === true, environment, settings,
      credentials: encryptField(JSON.stringify(secrets), this.encryptionKey),
    }));
  }
}
