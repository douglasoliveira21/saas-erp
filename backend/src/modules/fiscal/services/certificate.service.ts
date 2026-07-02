import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as forge from 'node-forge';
import { Certificate } from '../entities/certificate.entity';

const ENCRYPTION_KEY = process.env.CERT_ENCRYPTION_KEY || 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encrypted = parts.join(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

@Injectable()
export class CertificateService {
  constructor(
    @InjectRepository(Certificate)
    private certRepository: Repository<Certificate>,
  ) {}

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
    const pfxEncrypted = encrypt(pfxBuffer.toString('base64'));
    const passwordEncrypted = encrypt(password);

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
    const pfx = Buffer.from(decrypt(cert.pfxData), 'base64');
    const password = decrypt(cert.pfxPassword);
    return { pfx, password };
  }

  async getHttpsAgent(certId: string): Promise<any> {
    const { pfx, password } = await this.getPfxBuffer(certId);
    const https = require('https');
    return new https.Agent({ pfx, passphrase: password, rejectUnauthorized: false });
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
