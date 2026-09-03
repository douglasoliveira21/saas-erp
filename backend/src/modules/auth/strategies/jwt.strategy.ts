import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { env } from '../../../config/env.config';
import { TenantsService } from '../../platform/tenants.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService, private tenantsService: TenantsService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: any) => {
          const match = (request?.headers?.cookie || '').match(/(?:^|;\s*)access_token=([^;]+)/);
          return match ? decodeURIComponent(match[1]) : null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: env.jwt.secret,
    });
  }

  async validate(payload: any) {
    const user = await this.authService.validateUser(payload.sub, payload.sid);
    
    if (!user) {
      throw new UnauthorizedException();
    }

    // Recarregado a cada requisição (não fica preso no JWT assinado) — suspender um tenant ou
    // trocar o plano dele tem efeito imediato, sem esperar o usuário deslogar e logar de novo.
    let planModules: string[] = [];
    if (user.tenantId) {
      const status = await this.tenantsService.getTenantStatus(user.tenantId);
      if (status && status !== 'ativo') throw new UnauthorizedException('Conta suspensa ou cancelada. Contate o suporte.');
      planModules = await this.tenantsService.getEnabledModules(user.tenantId);
    }

    return {
      id: user.id,
      sessionId: payload.sid,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      planModules,
      permissions: user.permissions || payload.permissions || [],
    };
  }
}
