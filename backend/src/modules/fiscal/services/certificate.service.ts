import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as forge from 'node-forge';
import { Certificate } from '../entities/certificate.entity';
import { decryptField, encryptField, isEncryptedField, requireEncryptionSecret } from '../../../common/security/field-encryption';

const LEGACY_DEFAULT_KEY = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';

function decryptLegacy(text: string, secret: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encrypted = parts.join(':');
  const key = Buffer.from(secret.padEnd(32, '0').slice(0, 32));
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}

@Injectable()
export class CertificateService implements OnModuleInit {
  private readonly encryptionKey = requireEncryptionSecret('CERT_ENCRYPTION_KEY');
  private readonly previousEncryptionKey = process.env.CERT_ENCRYPTION_KEY_PREVIOUS || '';
  constructor(
    @InjectRepository(Certificate)
    private certRepository: Repository<Certificate>,
  ) {}

  async onModuleInit(): Promise<void> {
    const certificates = await this.certRepository.find();
    for (const certificate of certificates) {
      const valuesUseCurrentKey = [certificate.pfxData, certificate.pfxPassword].every(value => {
        if (!isEncryptedField(value)) return false;
        try { decryptField(value, [this.encryptionKey]); return true; } catch { return false; }
      });
      if (valuesUseCurrentKey) continue;
      const pfx = this.decryptProtected(certificate.pfxData);
      const password = this.decryptProtected(certificate.pfxPassword);
      certificate.pfxData = encryptField(pfx, this.encryptionKey);
      certificate.pfxPassword = encryptField(password, this.encryptionKey);
      await this.certRepository.save(certificate);
    }
  }

  private decryptProtected(value: string): string {
    if (isEncryptedField(value)) {
      return decryptField(value, [this.encryptionKey, this.previousEncryptionKey]);
    }
    const legacyKeys = [this.encryptionKey, this.previousEncryptionKey, LEGACY_DEFAULT_KEY].filter(Boolean);
    for (const key of legacyKeys) {
      try { return decryptLegacy(value, key); } catch { /* try next legacy key */ }
    }
    throw new Error('Nao foi possivel descriptografar o certificado legado');
  }

  async upload(pfxBuffer: Buffer, password: string, name: string, userId: string): Promise<Certificate> {
    // Validar certificado
    let p12: any;
    try {
      const asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
      p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
    } catch {
      throw new BadRequestException('Certificado invalido ou senha incorreta');
    }

    // Extrair informacoes
    const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = bags[forge.pki.oids.certBag];
    if (!certBag || certBag.length === 0) throw new BadRequestException('Certificado nao contem dados validos');

    const cert = certBag[0].cert;
    const subject = cert.subject.getField('CN');
    const serialNumber = cert.serialNumber;
    const validFrom = cert.validity.notBefore;
    const validUntil = cert.validity.notAfter;

    // Extrair CNPJ do subject
    let cnpj = '';
    const cnField = subject?.value || '';
    const cnpjMatch = cnField.match(/\d{14}/);
    if (cnpjMatch) cnpj = cnpjMatch[0];

    // Criptografar PFX e senha
    const pfxEncrypted = encryptField(pfxBuffer.toString('base64'), this.encryptionKey);
    const passwordEncrypted = encryptField(password, this.encryptionKey);

    const certificate = this.certRepository.create({
      name,
      companyName: cnField,
      cnpj,
      serialNumber,
      validFrom,
      validUntil,
      pfxData: pfxEncrypted,
      pfxPassword: passwordEncrypted,
      isActive: true,
      createdBy: userId,
    });

    return this.certRepository.save(certificate);
  }

  async findAll(): Promise<Certificate[]> {
    const certs = await this.certRepository.find({ order: { createdAt: 'DESC' } });
    // Nao retornar dados sensiveis
    return certs.map(c => ({ ...c, pfxData: '[ENCRYPTED]', pfxPassword: '[ENCRYPTED]' })) as any;
  }

  async findActive(cnpj?: string): Promise<Certificate> {
    const where: any = { isActive: true };
    if (cnpj) where.cnpj = cnpj;
    const cert = await this.certRepository.findOne({ where, order: { createdAt: 'DESC' } });
    if (!cert) throw new NotFoundException('Nenhum certificado ativo encontrado');
    return cert;
  }

  async getPfxBuffer(certId: string): Promise<{ pfx: Buffer; password: string }> {
    const cert = await this.certRepository.findOne({ where: { id: certId } });
    if (!cert) throw new NotFoundException('Certificado nao encontrado');
    const pfx = Buffer.from(this.decryptProtected(cert.pfxData), 'base64');
    const password = this.decryptProtected(cert.pfxPassword);
    return { pfx, password };
  }

  async getHttpsAgent(certId: string): Promise<any> {
    const { pfx, password } = await this.getPfxBuffer(certId);
    const https = require('https');
    return new https.Agent({
      pfx,
      passphrase: password,
      rejectUnauthorized: process.env.FISCAL_TLS_REJECT_UNAUTHORIZED !== 'false',
    });
  }

  async remove(id: string): Promise<void> {
    const cert = await this.certRepository.findOne({ where: { id } });
    if (!cert) throw new NotFoundException('Certificado nao encontrado');
    await this.certRepository.remove(cert);
  }

  async toggleActive(id: string): Promise<Certificate> {
    const cert = await this.certRepository.findOne({ where: { id } });
    if (!cert) throw new NotFoundException('Certificado nao encontrado');
    cert.isActive = !cert.isActive;
    return this.certRepository.save(cert);
  }
}
