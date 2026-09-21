import { BadRequestException, forwardRef, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { SuperAdmin } from './entities/super-admin.entity';
import { SuperAdminLoginCode } from './entities/super-admin-login-code.entity';
import { MailService } from '../mail/mail.service';

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const PENDING_TOKEN_TYPE = 'super_admin_2fa_pending';

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

// "jo***@gmail.com" - só pra confirmar visualmente pro admin que o código foi pro email certo,
// sem expor o endereço completo em uma resposta de API que ainda não autenticou ninguém.
function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${'*'.repeat(Math.max(user.length - visible.length, 3))}@${domain}`;
}

@Injectable()
export class SuperAdminAuthService {
  constructor(
    @InjectRepository(SuperAdmin) private superAdminsRepository: Repository<SuperAdmin>,
    @InjectRepository(SuperAdminLoginCode) private loginCodesRepository: Repository<SuperAdminLoginCode>,
    private jwtService: JwtService,
    // forwardRef: MailModule já importa PlatformModule (pro PlanGuard); sem isso, esse import
    // aqui na direção contrária forma um ciclo que o Nest recusa resolver no boot.
    @Inject(forwardRef(() => MailService)) private mailService: MailService,
  ) {}

  // Passo 1 do login: confere email/senha e, se corretos, manda um código de 6 dígitos por email
  // em vez de já liberar acesso - o token retornado aqui (pendingToken) só serve pra chamar
  // verifyCode() logo abaixo, nunca passa no SuperAdminJwtStrategy (que exige type='super_admin').
  async login(email: string, password: string) {
    const admin = await this.superAdminsRepository.findOne({ where: { email: (email || '').trim().toLowerCase() } });
    if (!admin || !admin.active) throw new UnauthorizedException('Credenciais inválidas');
    const valid = await bcrypt.compare(password || '', admin.password);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas');

    await this.issueAndSendCode(admin);

    return {
      requiresTwoFactor: true,
      pendingToken: this.jwtService.sign({ sub: admin.id, type: PENDING_TOKEN_TYPE }, { expiresIn: `${CODE_TTL_MINUTES}m` }),
      maskedEmail: maskEmail(admin.email),
    };
  }

  private async issueAndSendCode(admin: SuperAdmin): Promise<void> {
    // Invalida qualquer código anterior ainda válido - só o mais recente pode ser usado, evita
    // confusão se o admin pedir reenvio ou tentar logar de novo antes de usar o primeiro código.
    await this.loginCodesRepository.update({ superAdminId: admin.id, used: false }, { used: true });

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.loginCodesRepository.save(this.loginCodesRepository.create({
      superAdminId: admin.id,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
    }));

    await this.mailService.sendMail(
      admin.email,
      'Código de acesso - Painel Super Admin',
      `<div style="font-family:Arial,sans-serif">
        <h2>Código de verificação</h2>
        <p>Olá ${admin.name},</p>
        <p>Use o código abaixo para concluir o login no painel de administração da plataforma:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p>
        <p>Esse código expira em ${CODE_TTL_MINUTES} minutos. Se você não tentou fazer login, ignore este email.</p>
      </div>`,
    );
  }

  private verifyPendingToken(pendingToken: string): string {
    try {
      const payload = this.jwtService.verify(pendingToken || '');
      if (payload.type !== PENDING_TOKEN_TYPE || !payload.sub) throw new Error('invalid');
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Sessão de login expirada, faça login novamente');
    }
  }

  // Passo 2: confere o código de 6 dígitos e só ENTÃO emite o token de acesso de verdade.
  async verifyCode(pendingToken: string, code: string) {
    const adminId = this.verifyPendingToken(pendingToken);
    const admin = await this.superAdminsRepository.findOne({ where: { id: adminId } });
    if (!admin || !admin.active) throw new UnauthorizedException('Credenciais inválidas');

    const record = await this.loginCodesRepository.findOne({
      where: { superAdminId: adminId, used: false },
      order: { createdAt: 'DESC' },
    });
    if (!record || record.expiresAt < new Date()) throw new UnauthorizedException('Código expirado, solicite um novo');
    if (record.attempts >= MAX_ATTEMPTS) throw new UnauthorizedException('Muitas tentativas incorretas, solicite um novo código');

    if (hashCode((code || '').trim()) !== record.codeHash) {
      await this.loginCodesRepository.update(record.id, { attempts: record.attempts + 1 });
      throw new UnauthorizedException('Código incorreto');
    }

    await this.loginCodesRepository.update(record.id, { used: true });
    await this.superAdminsRepository.update(admin.id, { lastLoginAt: new Date() });
    const payload = { sub: admin.id, email: admin.email, type: 'super_admin' };
    return {
      access_token: this.jwtService.sign(payload),
      admin: { id: admin.id, name: admin.name, email: admin.email },
    };
  }

  // Reenvio: exige o mesmo pendingToken válido (não dá pra reenviar código pra um login que já
  // expirou ou nem começou), mantendo a mesma janela de expiração.
  async resendCode(pendingToken: string) {
    const adminId = this.verifyPendingToken(pendingToken);
    const admin = await this.superAdminsRepository.findOne({ where: { id: adminId } });
    if (!admin || !admin.active) throw new UnauthorizedException('Credenciais inválidas');
    await this.issueAndSendCode(admin);
    return { success: true, maskedEmail: maskEmail(admin.email) };
  }

  async changePassword(adminId: string, currentPassword: string, newPassword: string): Promise<{ success: true }> {
    const admin = await this.superAdminsRepository.findOne({ where: { id: adminId } });
    if (!admin) throw new UnauthorizedException();
    const valid = await bcrypt.compare(currentPassword || '', admin.password);
    if (!valid) throw new BadRequestException('Senha atual incorreta');
    if (!newPassword || newPassword.length < 8) throw new BadRequestException('A nova senha deve ter pelo menos 8 caracteres');
    if (await bcrypt.compare(newPassword, admin.password)) throw new BadRequestException('A nova senha deve ser diferente da atual');
    const hash = await bcrypt.hash(newPassword, 12);
    await this.superAdminsRepository.update(admin.id, { password: hash });
    return { success: true };
  }
}
