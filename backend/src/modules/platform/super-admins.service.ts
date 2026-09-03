import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { SuperAdmin } from './entities/super-admin.entity';

@Injectable()
export class SuperAdminsService {
  constructor(
    @InjectRepository(SuperAdmin) private readonly repo: Repository<SuperAdmin>,
  ) {}

  async findAll(): Promise<Omit<SuperAdmin, 'password'>[]> {
    const admins = await this.repo.find({ order: { createdAt: 'ASC' } });
    return admins.map(({ password, ...rest }) => rest);
  }

  async create(dto: { name: string; email: string; password: string }): Promise<Omit<SuperAdmin, 'password'>> {
    if (!dto.name?.trim() || !dto.email?.trim()) throw new BadRequestException('Informe nome e email');
    if (!dto.password || dto.password.length < 8) throw new BadRequestException('A senha deve ter pelo menos 8 caracteres');
    const email = dto.email.trim().toLowerCase();
    const existing = await this.repo.findOne({ where: { email } });
    if (existing) throw new BadRequestException('Já existe um super admin com este email');
    const password = await bcrypt.hash(dto.password, 12);
    const admin = await this.repo.save(this.repo.create({ name: dto.name.trim(), email, password, active: true }));
    const { password: _omit, ...rest } = admin;
    return rest;
  }

  // Impede que a última conta ativa seja desativada/removida — sem essa trava, um erro de
  // clique poderia trancar todo mundo para fora do painel do super admin, sem forma de entrar
  // de volta a não ser mexendo direto no banco.
  private async assertNotLastActive(excludingId: string): Promise<void> {
    const activeCount = await this.repo.count({ where: { active: true } });
    const target = await this.repo.findOne({ where: { id: excludingId } });
    if (target?.active && activeCount <= 1) {
      throw new BadRequestException('Não é possível remover/desativar o único super admin ativo.');
    }
  }

  async update(id: string, dto: { name?: string; email?: string; active?: boolean; password?: string }): Promise<Omit<SuperAdmin, 'password'>> {
    const admin = await this.repo.findOne({ where: { id } });
    if (!admin) throw new NotFoundException('Super admin não encontrado');
    if (dto.active === false) await this.assertNotLastActive(id);
    if (dto.name !== undefined) admin.name = dto.name.trim();
    if (dto.email !== undefined) admin.email = dto.email.trim().toLowerCase();
    if (dto.active !== undefined) admin.active = dto.active;
    if (dto.password) {
      if (dto.password.length < 8) throw new BadRequestException('A senha deve ter pelo menos 8 caracteres');
      admin.password = await bcrypt.hash(dto.password, 12);
    }
    const saved = await this.repo.save(admin);
    const { password, ...rest } = saved;
    return rest;
  }

  async remove(id: string): Promise<{ success: true }> {
    await this.assertNotLastActive(id);
    const admin = await this.repo.findOne({ where: { id } });
    if (!admin) throw new NotFoundException('Super admin não encontrado');
    await this.repo.remove(admin);
    return { success: true };
  }
}
