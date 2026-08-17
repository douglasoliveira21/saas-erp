import { Injectable, NotFoundException, BadRequestException, ForbiddenException, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Commission } from './entities/commission.entity';
import { AuditService } from '../audit/audit.service';
import { UserRole } from '../../common/enums/user-role.enum';
import { CommissionType } from '../../common/enums/commission-type.enum';
import { CommissionStatus } from '../../common/enums/commission-status.enum';

const isPrivilegedRole = (role?: string) => role === UserRole.ADMIN || role === UserRole.FINANCEIRO;

@Injectable()
export class CommissionsService implements OnModuleInit {
  private readonly logger = new Logger(CommissionsService.name);

  constructor(
    @InjectRepository(Commission)
    private commissionsRepository: Repository<Commission>,
    private auditService: AuditService,
  ) {}

  async onModuleInit() {
    // Generate fixed commissions for current month on startup
    setTimeout(async () => {
      try {
        const result = await this.generateMonthlyFixed();
        if (result.created > 0) {
          this.logger.log(`Comissoes fixas geradas automaticamente: ${result.created} de ${result.total}`);
        }
      } catch (e) {
        if (e.message?.includes('does not exist')) {
          this.logger.warn('Tabelas ainda não criadas. Comissões serão geradas no próximo restart.');
        } else {
          this.logger.error('Erro ao gerar comissoes fixas: ' + e.message);
        }
      }
    }, 5000);

    // Check every 6 hours if current month fixed commissions exist
    setInterval(async () => {
      try {
        const result = await this.generateMonthlyFixed();
        if (result.created > 0) {
          this.logger.log(`Comissoes fixas mensais geradas (check periódico): ${result.created}`);
        }
      } catch (e: any) {
        this.logger.error('Erro ao gerar comissoes fixas (check periódico): ' + e?.message);
      }
    }, 6 * 3600000);
  }

  async create(createCommissionDto: any, userId?: string, userRole?: string): Promise<Commission> {
    const dto = { ...createCommissionDto };

    // Técnicos só podem solicitar comissão avulsa para si mesmos, e ela nasce sempre pendente.
    // Sem isso, qualquer usuário autenticado poderia se auto-atribuir uma comissão já paga,
    // fixa/recorrente, ou em nome de outro técnico apenas manipulando o corpo da requisição.
    if (!isPrivilegedRole(userRole)) {
      dto.technicianId = userId;
      dto.type = CommissionType.AVULSA;
      dto.status = CommissionStatus.PENDENTE;
      dto.isRecurring = false;
      delete dto.referenceMonth;
      delete dto.approvedBy;
      delete dto.approvedAt;
      delete dto.paidBy;
      delete dto.paidAt;
    }

    // Se for fixa, marcar como recorrente e definir mes de referencia
    if (dto.type === 'fixa') {
      dto.isRecurring = true;
      dto.referenceMonth = dto.referenceMonth || new Date().toISOString().slice(0, 7);
    }

    const commission = this.commissionsRepository.create(dto);
    const saved = await this.commissionsRepository.save(commission);
    const result = Array.isArray(saved) ? saved[0] : saved;
    await this.auditService.safeCreate({
      userId,
      action: 'commission.created',
      entity: 'commission',
      entityId: result.id,
      newData: result,
    });
    return result;
  }

  // Gera comissoes fixas do mes para todos os tecnicos que tem comissao fixa
  async generateMonthlyFixed(month?: string): Promise<{ created: number; total: number }> {
    const refMonth = month || new Date().toISOString().slice(0, 7);

    // Buscar todas as comissoes fixas (template - pegar a mais recente de cada tecnico)
    const fixedTemplates = await this.commissionsRepository
      .createQueryBuilder('c')
      .where('c.type = :type', { type: 'fixa' })
      .andWhere('c.is_recurring = true')
      .andWhere('c.status != :cancelled', { cancelled: 'cancelada' })
      .orderBy('c.created_at', 'DESC')
      .getMany();

    // Agrupar por tecnico (pegar apenas a mais recente de cada)
    const byTech: Record<string, Commission> = {};
    for (const c of fixedTemplates) {
      if (!byTech[c.technicianId]) byTech[c.technicianId] = c;
    }

    let created = 0;
    let total = 0;

    for (const template of Object.values(byTech)) {
      // Verificar se ja existe comissao fixa deste mes para este tecnico
      const existing = await this.commissionsRepository.findOne({
        where: {
          technicianId: template.technicianId,
          type: 'fixa' as any,
          referenceMonth: refMonth,
        },
      });

      if (!existing) {
        const newCommission = this.commissionsRepository.create({
          technicianId: template.technicianId,
          type: 'fixa' as any,
          description: template.description || 'Comissao fixa mensal',
          baseValue: template.baseValue,
          percentage: template.percentage,
          amount: template.amount,
          status: 'pendente' as any,
          isRecurring: true,
          referenceMonth: refMonth,
        });
        await this.commissionsRepository.save(newCommission);
        created++;
        total += Number(template.amount);
      }
    }

    return { created, total };
  }

  async findAll(requesterId?: string, requesterRole?: string): Promise<Commission[]> {
    // Técnicos só podem ver a própria folha de comissão, não a de toda a empresa.
    const where = !isPrivilegedRole(requesterRole) && requesterId ? { technicianId: requesterId } : {};
    return this.commissionsRepository.find({
      where,
      relations: ['technician', 'sale'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, requesterId?: string, requesterRole?: string): Promise<Commission> {
    const commission = await this.commissionsRepository.findOne({
      where: { id },
      relations: ['technician', 'sale'],
    });
    if (!commission) throw new NotFoundException('Comissão não encontrada');
    if (!isPrivilegedRole(requesterRole) && requesterId && commission.technicianId !== requesterId) {
      throw new ForbiddenException('Você não tem acesso a esta comissão');
    }
    return commission;
  }

  async approve(id: string, userId: string): Promise<Commission> {
    const commission = await this.findOne(id);
    const oldData = { status: commission.status, paidAt: commission.paidAt, paidBy: commission.paidBy };
    if (!['pendente', 'aprovada'].includes(commission.status as any)) {
      throw new BadRequestException('Esta comissao nao pode ser paga');
    }
    commission.status = 'paga' as any;
    commission.paidBy = userId as any;
    commission.paidAt = new Date();
    const saved = await this.commissionsRepository.save(commission);
    await this.auditService.safeCreate({
      userId,
      action: 'commission.paid',
      entity: 'commission',
      entityId: id,
      oldData,
      newData: { status: saved.status, paidAt: saved.paidAt, paidBy: saved.paidBy, source: 'approve' },
    });
    return saved;
  }

  async pay(id: string, userId: string): Promise<Commission> {
    const commission = await this.findOne(id);
    const oldData = { status: commission.status, paidAt: commission.paidAt, paidBy: commission.paidBy };
    if (!['pendente', 'aprovada'].includes(commission.status as any)) {
      throw new BadRequestException('Esta comissao nao pode ser paga');
    }
    commission.status = 'paga' as any;
    commission.paidBy = userId as any;
    commission.paidAt = new Date();
    const saved = await this.commissionsRepository.save(commission);
    await this.auditService.safeCreate({
      userId,
      action: 'commission.paid',
      entity: 'commission',
      entityId: id,
      oldData,
      newData: { status: saved.status, paidAt: saved.paidAt, paidBy: saved.paidBy },
    });
    return saved;
  }

  async cancel(id: string, userId?: string): Promise<Commission> {
    const commission = await this.findOne(id);
    const oldStatus = commission.status;
    if (['paga', 'cancelada'].includes(commission.status as any)) {
      throw new BadRequestException('Esta comissao nao pode ser cancelada');
    }
    commission.status = 'cancelada' as any;
    const saved = await this.commissionsRepository.save(commission);
    await this.auditService.safeCreate({
      userId,
      action: 'commission.cancelled',
      entity: 'commission',
      entityId: id,
      oldData: { status: oldStatus },
      newData: { status: saved.status },
    });
    return saved;
  }

  async update(id: string, updateCommissionDto: any, userId?: string): Promise<Commission> {
    const commission = await this.findOne(id);
    const oldData = { ...commission };
    Object.assign(commission, updateCommissionDto);
    const saved = await this.commissionsRepository.save(commission);
    await this.auditService.safeCreate({
      userId,
      action: 'commission.updated',
      entity: 'commission',
      entityId: id,
      oldData,
      newData: updateCommissionDto,
    });
    return saved;
  }

  async remove(id: string, userId?: string): Promise<void> {
    const commission = await this.findOne(id);
    if (commission.status !== 'cancelada' as any) {
      throw new BadRequestException('Apenas comissoes canceladas podem ser excluidas');
    }
    await this.commissionsRepository.remove(commission);
    await this.auditService.safeCreate({
      userId,
      action: 'commission.deleted',
      entity: 'commission',
      entityId: id,
      oldData: commission,
      newData: { deleted: true },
    });
  }
}
