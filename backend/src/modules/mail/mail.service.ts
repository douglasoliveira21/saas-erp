import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    const port = parseInt(process.env.MAIL_PORT || '587');
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || 'mail.vgonhost.com.br',
      port,
      secure: port === 465,
      auth: {
        user: process.env.MAIL_USER || 'info@vgonhost.com.br',
        pass: process.env.MAIL_PASS || 'Vgon2018',
      },
      tls: { 
        rejectUnauthorized: false,
        ciphers: 'SSLv3',
      },
      authMethod: 'LOGIN',
    } as any);
    
    this.logger.log(`Mail configurado: ${process.env.MAIL_USER}@${process.env.MAIL_HOST}:${port}`);
  }

  async sendMail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: process.env.MAIL_FROM || 'info@vgonhost.com.br',
        to,
        subject,
        html,
      });
      this.logger.log('Email enviado para ' + to);
      return true;
    } catch (e) {
      this.logger.error('Erro ao enviar email para ' + to + ': ' + e.message);
      return false;
    }
  }

  async sendMailWithAttachment(to: string, subject: string, html: string, attachments: Array<{ filename: string; content: Buffer; contentType: string }>): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: process.env.MAIL_FROM || 'info@vgonhost.com.br',
        to,
        subject,
        html,
        attachments,
      });
      this.logger.log('Email com anexo enviado para ' + to);
      return true;
    } catch (e) {
      this.logger.error('Erro ao enviar email com anexo para ' + to + ': ' + e.message);
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
