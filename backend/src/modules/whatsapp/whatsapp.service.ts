import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappConfig } from './entities/whatsapp-config.entity';
import { WhatsappMessageLog } from './entities/whatsapp-message-log.entity';
import { decryptField, encryptField, isEncryptedField, maskSecret, requireEncryptionSecret } from '../../common/security/field-encryption';
import { env } from '../../config/env.config';

const isMasked = (value: unknown) => typeof value === 'string' && /^\*+$/.test(value);

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly credentialKey = requireEncryptionSecret('CREDENTIAL_ENCRYPTION_KEY');
  private readonly previousCredentialKey = process.env.CREDENTIAL_ENCRYPTION_KEY_PREVIOUS || '';

  constructor(
    @InjectRepository(WhatsappConfig) private configRepository: Repository<WhatsappConfig>,
    @InjectRepository(WhatsappMessageLog) private logsRepository: Repository<WhatsappMessageLog>,
  ) {}

  private async getOrCreateRow(): Promise<WhatsappConfig> {
    let row = await this.configRepository.findOne({ where: {} });
    if (!row) {
      row = this.configRepository.create({});
      row = await this.configRepository.save(row);
    }
    return row;
  }

  // Config exposta ao front (chave sempre mascarada, nunca volta em texto puro).
  async getPublicConfig(): Promise<any> {
    const row = await this.getOrCreateRow();
    return {
      ...row,
      apiUrl: row.apiUrl || env.evolution.apiUrl,
      apiKey: row.apiKey ? maskSecret('x') : (env.evolution.apiKey ? maskSecret('x') : null),
      hasEnvDefaults: Boolean(env.evolution.apiUrl && env.evolution.apiKey),
    };
  }

  async updateConfig(dto: any): Promise<any> {
    const row = await this.getOrCreateRow();
    if (dto.apiUrl !== undefined) row.apiUrl = dto.apiUrl || null;
    if (dto.instanceName !== undefined) row.instanceName = dto.instanceName || null;
    if (dto.notifyServiceOrders !== undefined) row.notifyServiceOrders = Boolean(dto.notifyServiceOrders);
    if (dto.apiKey !== undefined && dto.apiKey && !isMasked(dto.apiKey)) {
      row.apiKey = encryptField(dto.apiKey, this.credentialKey);
    }
    await this.configRepository.save(row);
    return this.getPublicConfig();
  }

  // Resolve URL/chave/instância: prioriza o que foi configurado pela tela de administração,
  // caindo para as variáveis de ambiente (EVOLUTION_API_URL / EVOLUTION_API_KEY) quando vazio.
  private async getEffectiveCreds(): Promise<{ apiUrl: string; apiKey: string; instanceName: string; row: WhatsappConfig }> {
    const row = await this.getOrCreateRow();
    const apiUrl = (row.apiUrl || env.evolution.apiUrl || '').trim().replace(/\/+$/, '');
    let apiKey = env.evolution.apiKey || '';
    if (row.apiKey) {
      apiKey = isEncryptedField(row.apiKey) ? decryptField(row.apiKey, [this.credentialKey, this.previousCredentialKey]) : row.apiKey;
    }
    const instanceName = row.instanceName || 'vgon';
    if (!apiUrl || !apiKey) throw new BadRequestException('Configure a URL e a chave da API do WhatsApp em Administração > WhatsApp.');
    return { apiUrl, apiKey, instanceName, row };
  }

  private async request(method: string, path: string, apiUrl: string, apiKey: string, body?: any): Promise<any> {
    const res = await fetch(apiUrl + path, {
      method,
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    if (!res.ok) {
      const message = json?.message || json?.error || text || `HTTP ${res.status}`;
      throw new Error(Array.isArray(message) ? message.join('; ') : String(message));
    }
    return json;
  }

  // Cria a instância na Evolution API caso ainda não exista.
  private async ensureInstance(): Promise<void> {
    const { apiUrl, apiKey, instanceName } = await this.getEffectiveCreds();
    // Primeiro confirma se a instância já existe (endpoint de consulta, que costuma ser permitido
    // pra qualquer chave). Só chama /instance/create quando ela realmente não existe — chamar
    // create toda vez, mesmo pra uma instância já existente, faz reconectar depender de uma
    // permissão (criar instância) que a chave configurada pode nem ter, mesmo sem nunca precisar
    // criar nada de novo. Antes disso causava "Forbidden" ao tentar gerar QR de uma instância
    // que já existia, porque o create sempre rodava primeiro.
    const alreadyExists = await this.request('GET', `/instance/connectionState/${instanceName}`, apiUrl, apiKey)
      .then(() => true)
      .catch(() => false);
    if (alreadyExists) return;

    try {
      await this.request('POST', '/instance/create', apiUrl, apiKey, {
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      });
    } catch (error: any) {
      const message = String(error.message || '').toLowerCase();
      if (!message.includes('already') && !message.includes('exist') && !message.includes('duplicate')) {
        throw error;
      }
    }
  }

  async getQrCode(): Promise<{ base64: string | null; pairingCode?: string }> {
    await this.ensureInstance();
    const { apiUrl, apiKey, instanceName } = await this.getEffectiveCreds();
    // Quando o WhatsApp cai (desconecta do celular), o socket Baileys da instancia fica preso
    // num estado "fechado" que faz /instance/connect sozinho nao gerar um QR valido pra
    // reconectar a MESMA instancia — a Evolution API precisa de um logout explicito antes pra
    // limpar essa sessao presa. Sem isso, a unica forma de reconectar seria apagar e recriar a
    // instancia inteira (perdendo o historico dela). O erro do logout e ignorado de proposito:
    // numa instancia que nunca conectou (primeiro QR) ele so retorna "nao conectado" ou similar.
    await this.request('DELETE', `/instance/logout/${instanceName}`, apiUrl, apiKey).catch(() => {});
    const response = await this.request('GET', `/instance/connect/${instanceName}`, apiUrl, apiKey);
    let base64 = response?.base64 || response?.qrcode?.base64 || null;
    if (base64 && !base64.startsWith('data:image')) base64 = `data:image/png;base64,${base64}`;
    return { base64, pairingCode: response?.pairingCode || response?.code };
  }

  async checkConnectionStatus(): Promise<{ connectionStatus: string; lastCheckedAt: Date; lastError: string | null }> {
    const row = await this.getOrCreateRow();
    try {
      const { apiUrl, apiKey, instanceName } = await this.getEffectiveCreds();
      const response = await this.request('GET', `/instance/connectionState/${instanceName}`, apiUrl, apiKey);
      const state = response?.instance?.state || response?.state;
      row.connectionStatus = state === 'open' ? 'conectado' : state === 'connecting' ? 'conectando' : 'desconectado';
      row.phoneNumber = response?.instance?.owner ? String(response.instance.owner).split('@')[0] : row.phoneNumber;
      row.lastError = null;
    } catch (error: any) {
      row.connectionStatus = 'erro';
      row.lastError = error.message;
    } finally {
      row.lastCheckedAt = new Date();
      await this.configRepository.save(row);
    }
    return { connectionStatus: row.connectionStatus, lastCheckedAt: row.lastCheckedAt, lastError: row.lastError };
  }

  async disconnectInstance(): Promise<void> {
    const { apiUrl, apiKey, instanceName } = await this.getEffectiveCreds();
    await this.request('DELETE', `/instance/logout/${instanceName}`, apiUrl, apiKey).catch(() => {});
    await this.checkConnectionStatus();
  }

  // Normaliza para o formato E.164 sem "+" esperado pela Evolution (ex: 5531999999999).
  private normalizePhone(raw: string): string | null {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return null;
    if (digits.length >= 12) return digits; // já tem código do país
    if (digits.length === 10 || digits.length === 11) return `55${digits}`; // DDD + número, sem 55
    return digits.length >= 8 ? digits : null;
  }

  private async logMessage(phone: string, type: string, status: string, opts: { relatedEntity?: string; relatedId?: string; preview?: string; error?: string } = {}) {
    await this.logsRepository.save(this.logsRepository.create({ phone, type, status, ...opts })).catch(() => {});
  }

  async sendText(rawPhone: string, text: string, context: { relatedEntity?: string; relatedId?: string } = {}): Promise<boolean> {
    const phone = this.normalizePhone(rawPhone);
    if (!phone) throw new BadRequestException('Número de telefone inválido para envio de WhatsApp');
    const { apiUrl, apiKey, instanceName } = await this.getEffectiveCreds();
    try {
      await this.request('POST', `/message/sendText/${instanceName}`, apiUrl, apiKey, { number: phone, text });
      await this.logMessage(phone, 'text', 'enviado', { ...context, preview: text.slice(0, 200) });
      return true;
    } catch (error: any) {
      await this.logMessage(phone, 'text', 'erro', { ...context, preview: text.slice(0, 200), error: error.message });
      throw error;
    }
  }

  async sendMedia(rawPhone: string, buffer: Buffer, mimetype: string, fileName: string, caption: string, context: { relatedEntity?: string; relatedId?: string } = {}): Promise<boolean> {
    const phone = this.normalizePhone(rawPhone);
    if (!phone) throw new BadRequestException('Número de telefone inválido para envio de WhatsApp');
    const { apiUrl, apiKey, instanceName } = await this.getEffectiveCreds();
    const mediatype = mimetype.startsWith('image/') ? 'image' : mimetype === 'application/pdf' ? 'document' : 'document';
    try {
      await this.request('POST', `/message/sendMedia/${instanceName}`, apiUrl, apiKey, {
        number: phone,
        mediatype,
        mimetype,
        media: buffer.toString('base64'),
        fileName,
        caption,
      });
      await this.logMessage(phone, 'document', 'enviado', { ...context, preview: fileName });
      return true;
    } catch (error: any) {
      await this.logMessage(phone, 'document', 'erro', { ...context, preview: fileName, error: error.message });
      throw error;
    }
  }

  async shouldNotifyServiceOrders(): Promise<boolean> {
    const row = await this.getOrCreateRow();
    return row.notifyServiceOrders;
  }

  async listLogs(limit = 50) {
    return this.logsRepository.find({ order: { createdAt: 'DESC' }, take: limit });
  }
}
