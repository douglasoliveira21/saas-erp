import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { PortalUser } from './entities/portal-user.entity';

@Injectable()
export class PortalAuthGuard implements CanActivate {
  constructor(private jwt: JwtService, @InjectRepository(PortalUser) private users: Repository<PortalUser>) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const header = String(request.headers.authorization || '');
    const cookie = String(request.headers.cookie || '').match(/(?:^|;\s*)portal_token=([^;]+)/)?.[1];
    const token = header.startsWith('Bearer ') ? header.slice(7) : cookie ? decodeURIComponent(cookie) : '';
    try {
      const payload = this.jwt.verify(token);
      if (payload.aud !== 'customer-portal') throw new Error();
      const user = await this.users.findOne({ where: { id: payload.sub, status: 'active' } });
      if (!user || user.customerId !== payload.customerId) throw new Error();
      request.portalUser = { ...payload, role: user.role, customerId: user.customerId };
      return true;
    } catch {
      throw new UnauthorizedException('Sessão do portal inválida, expirada ou bloqueada');
    }
  }
}