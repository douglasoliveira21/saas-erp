import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import * as https from 'https';
import * as nodemailer from 'nodemailer';
import { Repository } from 'typeorm';
import { EmailConfig } from './entities/email-config.entity';

type MailAttachment = { filename: string; content: Buffer; contentType: string };

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private configCache: EmailConfig | null = null;

  constructor(
    @InjectRepository(EmailConfig)
    private readonly configRepository: Repository<EmailConfig>,
  ) {
    this.transporter = this.createTransporter(this.getEnvConfig());
  }

  async onModuleInit() {
    await this.ensureConfigTable();
    const config = await this.getConfig();
    this.transporter = this.createTransporter(config);
    this.logger.log(`Mail configurado: ${config.authUser || config.fromEmail}@${config.host}:${config.port}`);
  }

  private async ensureConfigTable(): Promise<void> {
    try {
      await this.configRepository.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    } catch (error) {
      this.logger.warn('Extensao pgcrypto nao foi criada automaticamente: ' + error.message);
    }
    await this.configRepository.query(`
      CREATE TABLE IF NOT EXISTS email_configs (
        id uuid PRIMARY KEY,
        host varchar(255),
        port integer DEFAULT 587,
        secure boolean DEFAULT false,
        auth_user varchar(255),
        auth_pass text,
        from_email varchar(255),
        from_name varchar(255),
        copy_enabled boolean DEFAULT false,
        copy_email varchar(255),
        provider varchar(30) DEFAULT 'smtp',
        microsoft_tenant_id varchar(255),
        microsoft_client_id varchar(255),
        microsoft_client_secret text,
        microsoft_redirect_uri text,
        microsoft_refresh_token text,
        microsoft_access_token text,
        microsoft_token_expires_at timestamp,
        microsoft_user_email varchar(255),
        microsoft_state varchar(100),
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);
    await this.ensureColumn('provider', "varchar(30) DEFAULT 'smtp'");
    await this.ensureColumn('microsoft_tenant_id', 'varchar(255)');
    await this.ensureColumn('microsoft_client_id', 'varchar(255)');
    await this.ensureColumn('microsoft_client_secret', 'text');
    await this.ensureColumn('microsoft_redirect_uri', 'text');
    await this.ensureColumn('microsoft_refresh_token', 'text');
    await this.ensureColumn('microsoft_access_token', 'text');
    await this.ensureColumn('microsoft_token_expires_at', 'timestamp');
    await this.ensureColumn('microsoft_user_email', 'varchar(255)');
    await this.ensureColumn('microsoft_state', 'varchar(100)');
  }

  private async ensureColumn(name: string, definition: string): Promise<void> {
    await this.configRepository.query(`ALTER TABLE email_configs ADD COLUMN IF NOT EXISTS ${name} ${definition}`);
  }

  private getEnvConfig(): EmailConfig {
    return this.configRepository.create({
      id: randomUUID(),
      host: process.env.MAIL_HOST || 'mail.vgonhost.com.br',
      port: parseInt(process.env.MAIL_PORT || '587', 10),
      secure: parseInt(process.env.MAIL_PORT || '587', 10) === 465,
      authUser: process.env.MAIL_USER || 'info@vgonhost.com.br',
      authPass: process.env.MAIL_PASS || 'Vgon2018',
      fromEmail: process.env.MAIL_FROM || process.env.MAIL_USER || 'info@vgonhost.com.br',
      fromName: process.env.MAIL_FROM_NAME || 'VGON',
      copyEnabled: process.env.MAIL_COPY_ENABLED === 'true',
      copyEmail: process.env.MAIL_COPY_EMAIL || '',
      provider: process.env.MAIL_PROVIDER || 'smtp',
      microsoftTenantId: process.env.MICROSOFT_TENANT_ID || 'common',
      microsoftClientId: process.env.MICROSOFT_CLIENT_ID || '',
      microsoftClientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      microsoftRedirectUri: process.env.MICROSOFT_REDIRECT_URI || '',
    });
  }

  private createTransporter(config: EmailConfig): nodemailer.Transporter {
    const port = Number(config.port || 587);
    return nodemailer.createTransport({
      host: config.host,
      port,
      secure: Boolean(config.secure || port === 465),
      auth: {
        user: config.authUser,
        pass: config.authPass,
      },
      tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3',
      },
      authMethod: 'LOGIN',
    } as any);
  }

  private async getConfig(): Promise<EmailConfig> {
    if (this.configCache) return this.configCache;
    await this.ensureConfigTable();
    let config = await this.configRepository.findOne({ where: {} });
    if (!config) {
      config = await this.configRepository.save(this.getEnvConfig());
    }
    this.configCache = config;
    return config;
  }

  async getPublicConfig(): Promise<any> {
    const config = await this.getConfig();
    return {
      id: config.id,
      host: config.host,
      port: config.port,
      secure: config.secure,
      authUser: config.authUser,
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      copyEnabled: config.copyEnabled,
      copyEmail: config.copyEmail,
      provider: config.provider || 'smtp',
      microsoftTenantId: config.microsoftTenantId || 'common',
      microsoftClientId: config.microsoftClientId || '',
      microsoftRedirectUri: config.microsoftRedirectUri || '',
      microsoftUserEmail: config.microsoftUserEmail || '',
      microsoftConnected: Boolean(config.microsoftRefreshToken),
      hasMicrosoftClientSecret: Boolean(config.microsoftClientSecret),
      hasPassword: Boolean(config.authPass),
    };
  }

  async updateConfig(body: any): Promise<any> {
    await this.ensureConfigTable();
    let config = await this.configRepository.findOne({ where: {} });
    if (!config) config = this.configRepository.create(this.getEnvConfig());

    config.host = body.host || '';
    config.port = Number(body.port || 587);
    config.secure = Boolean(body.secure);
    config.authUser = body.authUser || '';
    if (body.authPass) config.authPass = body.authPass;
    config.fromEmail = body.fromEmail || body.authUser || '';
    config.fromName = body.fromName || 'VGON';
    config.copyEnabled = Boolean(body.copyEnabled);
    config.copyEmail = body.copyEmail || '';
    config.provider = body.provider || 'smtp';
    config.microsoftTenantId = body.microsoftTenantId || 'common';
    config.microsoftClientId = body.microsoftClientId || '';
    if (body.microsoftClientSecret) config.microsoftClientSecret = body.microsoftClientSecret;
    config.microsoftRedirectUri = body.microsoftRedirectUri || '';

    const saved = await this.configRepository.save(config);
    this.configCache = saved;
    this.transporter = this.createTransporter(saved);
    return this.getPublicConfig();
  }

  async sendMail(to: string, subject: string, html: string): Promise<boolean> {
    return this.sendMailWithAttachment(to, subject, html, []);
  }

  async sendMailWithAttachment(to: string, subject: string, html: string, attachments: MailAttachment[] = []): Promise<boolean> {
    try {
      const config = await this.getConfig();
      if ((config.provider || 'smtp') === 'microsoft365') {
        await this.sendMicrosoftMail(config, to, subject, html, attachments);
        this.logger.log('Email Microsoft 365 enviado para ' + to);
        return true;
      }

      const fromName = config.fromName || 'VGON';
      const fromEmail = config.fromEmail || config.authUser;
      await this.transporter.sendMail({
        from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
        to,
        cc: config.copyEnabled && config.copyEmail ? config.copyEmail : undefined,
        subject,
        html,
        attachments,
      });
      this.logger.log('Email enviado para ' + to);
      return true;
    } catch (e) {
      this.logger.error('Erro ao enviar email para ' + to + ': ' + e.message);
      return false;
    }
  }

  async getMicrosoftAuthUrl(redirectUri?: string): Promise<{ url: string; state: string }> {
    const config = await this.getConfig();
    const tenant = config.microsoftTenantId || 'common';
    const state = randomUUID();
    config.microsoftState = state;
    if (redirectUri) config.microsoftRedirectUri = redirectUri;
    await this.configRepository.save(config);
    this.configCache = config;

    const params = new URLSearchParams({
      client_id: config.microsoftClientId || '',
      response_type: 'code',
      redirect_uri: redirectUri || config.microsoftRedirectUri || '',
      response_mode: 'query',
      scope: 'offline_access User.Read Mail.Send',
      state,
      prompt: 'select_account',
    });

    return {
      url: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`,
      state,
    };
  }

  async connectMicrosoft(code: string, state?: string, redirectUri?: string): Promise<any> {
    const config = await this.getConfig();
    if (config.microsoftState && state && config.microsoftState !== state) {
      throw new Error('Estado de autenticacao Microsoft invalido');
    }

    const token = await this.requestMicrosoftToken(config, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri || config.microsoftRedirectUri || '',
    });

    config.microsoftAccessToken = token.access_token;
    config.microsoftRefreshToken = token.refresh_token || config.microsoftRefreshToken;
    config.microsoftTokenExpiresAt = new Date(Date.now() + Number(token.expires_in || 3600) * 1000);
    config.microsoftRedirectUri = redirectUri || config.microsoftRedirectUri;
    config.provider = 'microsoft365';
    config.microsoftState = null;

    try {
      const me = await this.microsoftJsonRequest('GET', '/v1.0/me', config.microsoftAccessToken);
      config.microsoftUserEmail = me.mail || me.userPrincipalName || '';
      config.fromEmail = config.microsoftUserEmail || config.fromEmail;
    } catch (error) {
      this.logger.warn('Nao foi possivel obter usuario Microsoft: ' + error.message);
    }

    const saved = await this.configRepository.save(config);
    this.configCache = saved;
    return this.getPublicConfig();
  }

  async disconnectMicrosoft(): Promise<any> {
    const config = await this.getConfig();
    config.microsoftAccessToken = null;
    config.microsoftRefreshToken = null;
    config.microsoftTokenExpiresAt = null;
    config.microsoftUserEmail = null;
    config.microsoftState = null;
    if (config.provider === 'microsoft365') config.provider = 'smtp';
    const saved = await this.configRepository.save(config);
    this.configCache = saved;
    return this.getPublicConfig();
  }

  private async getMicrosoftAccessToken(config: EmailConfig): Promise<string> {
    if (
      config.microsoftAccessToken &&
      config.microsoftTokenExpiresAt &&
      config.microsoftTokenExpiresAt.getTime() > Date.now() + 60000
    ) {
      return config.microsoftAccessToken;
    }

    if (!config.microsoftRefreshToken) {
      throw new Error('Conta Microsoft 365 nao conectada');
    }

    const token = await this.requestMicrosoftToken(config, {
      grant_type: 'refresh_token',
      refresh_token: config.microsoftRefreshToken,
    });

    config.microsoftAccessToken = token.access_token;
    config.microsoftRefreshToken = token.refresh_token || config.microsoftRefreshToken;
    config.microsoftTokenExpiresAt = new Date(Date.now() + Number(token.expires_in || 3600) * 1000);
    const saved = await this.configRepository.save(config);
    this.configCache = saved;
    return saved.microsoftAccessToken;
  }

  private requestMicrosoftToken(config: EmailConfig, values: Record<string, string>): Promise<any> {
    const tenant = config.microsoftTenantId || 'common';
    const body = new URLSearchParams({
      client_id: config.microsoftClientId || '',
      client_secret: config.microsoftClientSecret || '',
      scope: 'offline_access User.Read Mail.Send',
      ...values,
    }).toString();

    return this.httpsJsonRequest(
      'POST',
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      body,
      { 'Content-Type': 'application/x-www-form-urlencoded' },
    );
  }

  private async sendMicrosoftMail(config: EmailConfig, to: string, subject: string, html: string, attachments: MailAttachment[]): Promise<void> {
    const token = await this.getMicrosoftAccessToken(config);
    const messageAttachments = attachments.map((attachment) => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: attachment.filename,
      contentType: attachment.contentType,
      contentBytes: attachment.content.toString('base64'),
    }));

    const message: any = {
      subject,
      body: { contentType: 'HTML', content: html },
      toRecipients: this.toGraphRecipients(to),
      attachments: messageAttachments,
    };

    if (config.copyEnabled && config.copyEmail) {
      message.ccRecipients = this.toGraphRecipients(config.copyEmail);
    }

    await this.microsoftJsonRequest('POST', '/v1.0/me/sendMail', token, {
      message,
      saveToSentItems: true,
    });
  }

  private toGraphRecipients(value: string): Array<{ emailAddress: { address: string } }> {
    return String(value || '')
      .split(/[;,]/)
      .map(email => email.trim())
      .filter(Boolean)
      .map(email => ({ emailAddress: { address: email } }));
  }

  private microsoftJsonRequest(method: string, path: string, token: string, body?: any): Promise<any> {
    return this.httpsJsonRequest(method, `https://graph.microsoft.com${path}`, body, {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  private httpsJsonRequest(method: string, urlValue: string, body?: any, headers: Record<string, string> = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(urlValue);
      const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers: {
          ...headers,
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString();
          const data = raw ? this.safeJson(raw) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(data?.error_description || data?.error?.message || data?.error || raw || `HTTP ${res.statusCode}`));
          }
        });
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  private safeJson(raw: string): any {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  async sendPasswordReset(to: string, name: string, token: string, baseUrl: string): Promise<boolean> {
    const resetUrl = baseUrl + '/reset-password?token=' + token;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #2563eb; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">VGON - Sistema de Gestao</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1f2937;">Recuperacao de Senha</h2>
          <p style="color: #4b5563;">Ola ${name},</p>
          <p style="color: #4b5563;">Recebemos uma solicitacao para redefinir sua senha. Clique no botao abaixo:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: #2563eb; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">Redefinir Senha</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Este link expira em 1 hora.</p>
          <p style="color: #6b7280; font-size: 14px;">Se voce nao solicitou, ignore este email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">VGON Solucoes em Informatica</p>
        </div>
      </div>
    `;
    return this.sendMail(to, 'Recuperacao de Senha - VGON', html);
  }

  async sendSaleNotification(to: string, sale: { customerName: string; totalAmount: number; technicianName: string; paymentMethod: string }): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #2563eb; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">Nova Venda Registrada</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1f2937;">Pendencias Financeiras</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px; color: #6b7280;">Cliente:</td><td style="padding: 8px; font-weight: bold;">${sale.customerName}</td></tr>
            <tr><td style="padding: 8px; color: #6b7280;">Tecnico:</td><td style="padding: 8px;">${sale.technicianName}</td></tr>
            <tr><td style="padding: 8px; color: #6b7280;">Valor Total:</td><td style="padding: 8px; font-weight: bold; color: #059669;">R$ ${sale.totalAmount.toFixed(2)}</td></tr>
            <tr><td style="padding: 8px; color: #6b7280;">Pagamento:</td><td style="padding: 8px;">${sale.paymentMethod}</td></tr>
          </table>
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="color: #92400e; margin: 0; font-weight: bold;">Pendencias:</p>
            <ul style="color: #92400e; margin: 10px 0;">
              <li>Emissao de Nota Fiscal</li>
              ${sale.paymentMethod === 'boleto' ? '<li>Emissao de Boleto</li>' : ''}
            </ul>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Acesse o sistema para gerenciar as pendencias.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">VGON Solucoes em Informatica</p>
        </div>
      </div>
    `;
    return this.sendMail(to, 'Nova Venda - Pendencias Financeiras', html);
  }
}
