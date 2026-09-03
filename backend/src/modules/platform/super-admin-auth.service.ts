import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SuperAdmin } from './entities/super-admin.entity';

@Injectable()
export class SuperAdminAuthService {
  constructor(
    @InjectRepository(SuperAdmin) private superAdminsRepository: Repository<SuperAdmin>,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const admin = await this.superAdminsRepository.findOne({ where: { email: (email || '').trim().toLowerCase() } });
    if (!admin || !admin.active) throw new UnauthorizedException('Credenciais inválidas');
    const valid = await bcrypt.compare(password || '', admin.password);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas');
    await this.superAdminsRepository.update(admin.id, { lastLoginAt: new Date() });
    const payload = { sub: admin.id, email: admin.email, type: 'super_admin' };
    return {
      access_token: this.jwtService.sign(payload),
      admin: { id: admin.id, name: admin.name, email: admin.email },
    };
  }
}
