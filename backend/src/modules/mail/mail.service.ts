import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
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
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);
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
