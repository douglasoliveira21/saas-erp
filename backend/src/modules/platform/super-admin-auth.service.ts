import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
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
