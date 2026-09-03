import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SuperAdmin } from '../entities/super-admin.entity';
import { env } from '../../../config/env.config';

// Nome próprio ('jwt-super-admin', não o 'jwt' default) para nunca colidir com o
// JwtStrategy dos tenants (backend/src/modules/auth/strategies/jwt.strategy.ts) — os dois
// guards ficam completamente isolados um do outro.
@Injectable()
export class SuperAdminJwtStrategy extends PassportStrategy(Strategy, 'jwt-super-admin') {
  constructor(
    @InjectRepository(SuperAdmin) private superAdminsRepository: Repository<SuperAdmin>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.platform.superAdminJwtSecret,
    });
  }

  async validate(payload: any) {
    if (payload.type !== 'super_admin') throw new UnauthorizedException();
    const admin = await this.superAdminsRepository.findOne({ where: { id: payload.sub } });
    if (!admin || !admin.active) throw new UnauthorizedException();
    return { id: admin.id, name: admin.name, email: admin.email, isSuperAdmin: true as const };
  }
}
