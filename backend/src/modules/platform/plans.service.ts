import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';

@Injectable()
export class PlansService {
  constructor(@InjectRepository(Plan) private plansRepository: Repository<Plan>) {}

  findAll(includeInactive = true) {
    return this.plansRepository.find({
      where: includeInactive ? {} : { active: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async findOne(id: string) {
    const plan = await this.plansRepository.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    return plan;
  }

  async create(dto: any) {
    if (!dto.name?.trim()) throw new BadRequestException('Informe o nome do plano');
    const maxOrder = await this.plansRepository
      .createQueryBuilder('p')
      .select('COALESCE(MAX(p.sortOrder), 0)', 'max')
      .getRawOne();
    const plan = this.plansRepository.create({
      name: dto.name.trim(),
      description: dto.description || null,
      price: Number(dto.price || 0),
      billingCycle: dto.billingCycle || 'mensal',
      modules: Array.isArray(dto.modules) ? dto.modules : [],
      limits: dto.limits && typeof dto.limits === 'object' ? dto.limits : {},
      active: dto.active !== false,
      sortOrder: Number(maxOrder?.max || 0) + 1,
    });
    return this.plansRepository.save(plan);
  }

  async update(id: string, dto: any) {
    const plan = await this.findOne(id);
    if (dto.name !== undefined) plan.name = dto.name.trim();
    if (dto.description !== undefined) plan.description = dto.description || null;
    if (dto.price !== undefined) plan.price = Number(dto.price || 0);
    if (dto.billingCycle !== undefined) plan.billingCycle = dto.billingCycle;
    if (dto.modules !== undefined) plan.modules = Array.isArray(dto.modules) ? dto.modules : [];
    if (dto.limits !== undefined) plan.limits = dto.limits && typeof dto.limits === 'object' ? dto.limits : {};
    if (dto.active !== undefined) plan.active = Boolean(dto.active);
    if (dto.sortOrder !== undefined) plan.sortOrder = Number(dto.sortOrder);
    return this.plansRepository.save(plan);
  }

  async remove(id: string) {
    const plan = await this.findOne(id);
    const inUse = await this.plansRepository.manager.query(`SELECT COUNT(*)::int AS count FROM tenants WHERE plan_id = $1`, [id]);
    if (Number(inUse[0]?.count) > 0) {
      // Preferimos desativar a excluir um plano em uso: tenants não podem ficar apontando para
      // um plano que sumiu.
      plan.active = false;
      await this.plansRepository.save(plan);
      return { deactivated: true };
    }
    await this.plansRepository.remove(plan);
    return { deleted: true };
  }
}
