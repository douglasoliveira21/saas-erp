import { Injectable, UnauthorizedException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { PasswordReset } from './entities/password-reset.entity';
import { AuthSession } from './entities/auth-session.entity';
import { MailService } from '../mail/mail.service';
import { TenantsService } from '../platform/tenants.service';

type ClientInfo = { ip?: string; userAgent?: string; deviceName?: string };

@Injectable()
export class AuthService {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();
  private readonly maxAttempts = Number(process.env.AUTH_MAX_ATTEMPTS || 5);
  private readonly lockMinutes = Number(process.env.AUTH_LOCK_MINUTES || 15);

  constructor(
    private usersService: UsersService, private jwtService: JwtService, private mailService: MailService,
    private tenantsService: TenantsService,
    @InjectRepository(PasswordReset) private resetRepository: Repository<PasswordReset>,
    @InjectRepository(AuthSession) private sessionRepository: Repository<AuthSession>,
  ) {}

  private throttle(key: string, limit = this.maxAttempts) {
    const now = Date.now(); const current = this.attempts.get(key);
    if (!current || current.resetAt <= now) { this.attempts.set(key, { count: 1, resetAt: now + this.lockMinutes * 60000 }); return; }
    current.count += 1;
    if (current.count > limit) throw new HttpException('Muitas tentativas. Aguarde antes de tentar novamente.', HttpStatus.TOO_MANY_REQUESTS);
  }

  async login(loginDto: LoginDto, client: ClientInfo = {}) {
    const email = loginDto.email.trim().toLowerCase();
    this.throttle('login:' + (client.ip || 'unknown') + ':' + email);
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Credenciais invalidas');
    if (user.lockedUntil && user.lockedUntil > new Date()) throw new HttpException('Conta temporariamente bloqueada. Tente novamente mais tarde.', HttpStatus.TOO_MANY_REQUESTS);
    const valid = await bcrypt.compare(loginDto.password, user.password);
    if (!valid) {
      const failures = (user.failedLoginAttempts || 0) + 1;
      const patch: any = { failedLoginAttempts: failures };
      if (failures >= this.maxAttempts) patch.lockedUntil = new Date(Date.now() + this.lockMinutes * 60000);
      await this.usersService.update(user.id, patch);
      throw new UnauthorizedException('Credenciais invalidas');
    }
    if (!user.active) throw new UnauthorizedException('Usuario inativo');
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    const session = await this.sessionRepository.save(this.sessionRepository.create({ userId: user.id, deviceName: client.deviceName || this.describeDevice(client.userAgent), userAgent: client.userAgent, ipAddress: client.ip, lastSeenAt: new Date(), expiresAt }));
    await this.usersService.update(user.id, { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } as any);
    const payload = { sub: user.id, sid: session.id, email: user.email, role: user.role, tenantId: user.tenantId, permissions: user.permissions || [] };
    // Mesma resolução de módulos do plano que o JwtStrategy faz em requisições subsequentes —
    // sem isso, a resposta do login (usada para popular o AuthContext na hora) ficaria
    // inconsistente com a sessão restaurada depois de um F5 (/auth/session), que já passa por lá.
    const planModules = user.tenantId ? await this.tenantsService.getEnabledModules(user.tenantId) : [];
    return { access_token: this.jwtService.sign(payload), user: { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId, planModules, permissions: user.permissions || [] } };
  }

  private describeDevice(agent = '') {
    const browser = /Edg/i.test(agent) ? 'Edge' : /Chrome/i.test(agent) ? 'Chrome' : /Firefox/i.test(agent) ? 'Firefox' : /Safari/i.test(agent) ? 'Safari' : 'Navegador';
    const os = /Windows/i.test(agent) ? 'Windows' : /Android/i.test(agent) ? 'Android' : /iPhone|iPad/i.test(agent) ? 'iOS' : /Mac/i.test(agent) ? 'macOS' : /Linux/i.test(agent) ? 'Linux' : 'Dispositivo';
    return browser + ' em ' + os;
  }

  async validateUser(userId: string, sessionId?: string) {
    const user = await this.usersService.findOne(userId);
    if (!user || !user.active) return null;
    if (sessionId) {
      const session = await this.sessionRepository.findOne({ where: { id: sessionId, userId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) } });
      if (!session) return null;
      if (Date.now() - new Date(session.lastSeenAt).getTime() > 60000) await this.sessionRepository.update(session.id, { lastSeenAt: new Date() });
    }
    return user;
  }

  async logout(userId?: string, sessionId?: string) { if (userId && sessionId) await this.sessionRepository.update({ id: sessionId, userId }, { revokedAt: new Date() }); }
  async listSessions(userId: string, currentId?: string) { const rows = await this.sessionRepository.find({ where: { userId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) }, order: { lastSeenAt: 'DESC' } }); return rows.map(({ userAgent, ...s }) => ({ ...s, current: s.id === currentId })); }
  async revokeSession(userId: string, id: string) { await this.sessionRepository.update({ id, userId }, { revokedAt: new Date() }); return { success: true }; }
  async revokeOtherSessions(userId: string, currentId?: string) { const sessions = await this.sessionRepository.find({ where: { userId, revokedAt: IsNull() } }); const ids = sessions.filter(s => s.id !== currentId).map(s => s.id); if (ids.length) await this.sessionRepository.update(ids, { revokedAt: new Date() }); return { success: true }; }

  async forgotPassword(email: string, client: ClientInfo = {}) {
    const normalized = (email || '').trim().toLowerCase(); this.throttle('reset:' + (client.ip || 'unknown') + ':' + normalized, 3);
    const user = await this.usersService.findByEmail(normalized);
    if (!user) return { message: 'Se o email estiver cadastrado, voce recebera um link de recuperacao.' };
    await this.resetRepository.update({ userId: user.id, used: false }, { used: true, usedAt: new Date() });
    const token = crypto.randomBytes(32).toString('hex'); const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + Number(process.env.PASSWORD_RESET_MINUTES || 60) * 60000);
    await this.resetRepository.save(this.resetRepository.create({ userId: user.id, tokenHash, expiresAt }));
    await this.mailService.sendPasswordReset(user.email, user.name, token, process.env.FRONTEND_URL || 'http://localhost:5001');
    return { message: 'Se o email estiver cadastrado, voce recebera um link de recuperacao.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = crypto.createHash('sha256').update(token || '').digest('hex');
    const reset = await this.resetRepository.findOne({ where: { tokenHash, used: false }, relations: ['user'] });
    if (!reset || new Date() > reset.expiresAt) throw new BadRequestException('Token invalido ou expirado');
    await this.usersService.update(reset.userId, { password: await bcrypt.hash(newPassword, 12) } as any);
    await this.resetRepository.update({ userId: reset.userId, used: false }, { used: true, usedAt: new Date() });
    await this.sessionRepository.update({ userId: reset.userId, revokedAt: IsNull() }, { revokedAt: new Date() });
    return { message: 'Senha alterada com sucesso!' };
  }

  async updateProfile(userId: string, dto: { name?: string; email?: string; password?: string; currentPassword?: string }) {
    const user = await this.usersService.findOne(userId);
    if (dto.password) { if (!dto.currentPassword) throw new BadRequestException('Senha atual e obrigatoria para alterar a senha'); if (!await bcrypt.compare(dto.currentPassword, user.password)) throw new BadRequestException('Senha atual incorreta'); }
    const data: any = {}; if (dto.name) data.name=dto.name; if (dto.email && dto.email !== user.email) data.email=dto.email; if (dto.password) data.password=await bcrypt.hash(dto.password,12);
    if (!Object.keys(data).length) return { message:'Nenhuma alteracao realizada', user:{id:user.id,name:user.name,email:user.email,role:user.role} };
    await this.usersService.update(userId,data); const updated=await this.usersService.findOne(userId);
    return { message:'Perfil atualizado com sucesso!', user:{id:updated.id,name:updated.name,email:updated.email,role:updated.role,permissions:updated.permissions||[]} };
  }
}
