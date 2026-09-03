import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Tenant } from './entities/tenant.entity';
import { Plan } from './entities/plan.entity';
import { UsersService } from '../users/users.service';
import { UserRole } from '../../common/enums/user-role.enum';

function slugify(value: string): string {
  return value
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'tenant';
}

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant) private tenantsRepository: Repository<Tenant>,
    @InjectRepository(Plan) private plansRepository: Repository<Plan>,
    private usersService: UsersService,
  ) {}

  async findAll() {
    const tenants = await this.tenantsRepository.find({ relations: ['plan'], order: { createdAt: 'DESC' } });
    // Uso atual de cada tenant (só contagem de usuários por enquanto — os demais limites do
    // plano passam a ser medidos módulo a módulo conforme cada um for migrado, Fase 3).
    const usage = await this.tenantsRepository.manager.query(
      `SELECT tenant_id, COUNT(*)::int AS user_count FROM users GROUP BY tenant_id`,
    );
    const usageMap = new Map(usage.map((row: any) => [row.tenant_id, row.user_count]));
    return tenants.map((tenant) => ({ ...tenant, userCount: usageMap.get(tenant.id) || 0 }));
  }

  async findOne(id: string) {
    const tenant = await this.tenantsRepository.findOne({ where: { id }, relations: ['plan'] });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    return tenant;
  }

  // Usado pelo PlanGuard e pelo login (JwtStrategy) — sem cache por enquanto, é uma consulta
  // simples por id indexado; se o volume de requisições justificar, dá pra cachear por alguns
  // segundos depois.
  async getEnabledModules(tenantId: string): Promise<string[]> {
    const tenant = await this.tenantsRepository.findOne({ where: { id: tenantId }, relations: ['plan'] });
    return tenant?.plan?.modules || [];
  }

  async getTenantStatus(tenantId: string): Promise<string | null> {
    const tenant = await this.tenantsRepository.findOne({ where: { id: tenantId } });
    return tenant?.status || null;
  }

  // Lança se o uso atual já atingiu o limite do plano. limit undefined/null = sem limite
  // configurado (plano "ilimitado" nesse quesito) — só bloqueia quando o limite existe.
  async assertWithinLimit(tenantId: string, limitKey: 'maxUsers' | 'maxInvoicesPerMonth' | 'maxServiceOrdersPerMonth', currentCount: number, message: string): Promise<void> {
    const tenant = await this.tenantsRepository.findOne({ where: { id: tenantId }, relations: ['plan'] });
    const limit = tenant?.plan?.limits?.[limitKey];
    if (limit != null && currentCount >= limit) {
      throw new BadRequestException(message);
    }
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = slugify(base);
    let attempt = 0;
    while (await this.tenantsRepository.findOne({ where: { slug } })) {
      attempt += 1;
      slug = `${slugify(base)}-${attempt + 1}`;
    }
    return slug;
  }

  // Cria o tenant e já provisiona o primeiro usuário admin dele — sem isso, ninguém consegue
  // logar no tenant recém-criado. A senha temporária só existe em texto puro no retorno desta
  // chamada (nunca é armazenada nem logada); o super admin repassa para o cliente uma vez.
  async create(dto: { name: string; document?: string; planId?: string; adminName: string; adminEmail: string }) {
    if (!dto.name?.trim()) throw new BadRequestException('Informe o nome do cliente');
    if (!dto.adminName?.trim() || !dto.adminEmail?.trim()) throw new BadRequestException('Informe nome e email do administrador do cliente');
    if (dto.planId) {
      const plan = await this.plansRepository.findOne({ where: { id: dto.planId } });
      if (!plan) throw new BadRequestException('Plano inválido');
    }

    const slug = await this.uniqueSlug(dto.name);
    const tenant = await this.tenantsRepository.save(
      this.tenantsRepository.create({ name: dto.name.trim(), slug, document: dto.document || null, planId: dto.planId || null, status: 'ativo' }),
    );

    const tempPassword = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
    await this.usersService.create(
      { name: dto.adminName.trim(), email: dto.adminEmail.trim().toLowerCase(), password: tempPassword, role: UserRole.ADMIN } as any,
      tenant.id,
    );

    return { tenant: await this.findOne(tenant.id), adminEmail: dto.adminEmail.trim().toLowerCase(), tempPassword };
  }

  async update(id: string, dto: { name?: string; document?: string; planId?: string; status?: string }) {
    const tenant = await this.findOne(id);
    if (dto.planId !== undefined) {
      if (dto.planId) {
        const plan = await this.plansRepository.findOne({ where: { id: dto.planId } });
        if (!plan) throw new BadRequestException('Plano inválido');
      }
      tenant.planId = dto.planId || null;
    }
    if (dto.name !== undefined) tenant.name = dto.name.trim();
    if (dto.document !== undefined) tenant.document = dto.document || null;
    if (dto.status !== undefined) {
      if (!['ativo', 'suspenso', 'cancelado'].includes(dto.status)) throw new BadRequestException('Status inválido');
      tenant.status = dto.status;
    }
    await this.tenantsRepository.save(tenant);
    return this.findOne(id);
  }
}
