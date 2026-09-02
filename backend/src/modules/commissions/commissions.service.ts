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

  // Gera comissoes fixas de todos os meses (desde a criacao de cada uma ate o mes alvo) para
  // todos os tecnicos que tem comissao fixa. Antes só checava/gerava o mes alvo isoladamente —
  // se o backend ficasse fora do ar (ou ninguem clicasse "Gerar Fixas") durante um mes inteiro,
  // aquele mes ficava permanentemente sem comissao, sem nenhuma forma automatica de recuperar.
  async generateMonthlyFixed(month?: string): Promise<{ created: number; total: number }> {
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    const fixedTemplates = await this.commissionsRepository
      .createQueryBuilder('c')
      .where('c.type = :type', { type: 'fixa' })
      .andWhere('c.is_recurring = true')
      .andWhere('c.status != :cancelled', { cancelled: 'cancelada' })
      .orderBy('c.created_at', 'DESC')
      .getMany();

    // Um mesmo tecnico costuma ter VARIAS comissoes fixas independentes (uma por contrato/motivo:
    // "GLPI", "RODOCAP - Participação de Contrato", etc.) — nao uma unica. Agrupar so por tecnico
    // e propagar apenas a mais recente perdia todas as outras a partir do mes seguinte. Agrupamos
    // por tecnico + descricao normalizada (sem diferencas de espaçamento) para tratar cada uma
    // como sua propria serie recorrente independente.
    const bySeries: Record<string, { template: Commission; earliestMonth: string }> = {};
    for (const c of fixedTemplates) {
      const key = `${c.technicianId}::${this.normalizeDescription(c.description)}`;
      const series = bySeries[key];
      if (!series) {
        // fixedTemplates vem ordenado created_at DESC, entao o primeiro visto por chave e o
        // template (o mais recente com esses dados/valor).
        bySeries[key] = { template: c, earliestMonth: c.referenceMonth };
      } else if (c.referenceMonth && (!series.earliestMonth || c.referenceMonth < series.earliestMonth)) {
        series.earliestMonth = c.referenceMonth;
      }
    }

    let created = 0;
    let total = 0;

    for (const { template, earliestMonth } of Object.values(bySeries)) {
      const months = this.monthsBetween(earliestMonth || template.referenceMonth, targetMonth);
      for (const refMonth of months) {
        // Verificar se ja existe esta serie (tecnico + descricao normalizada) neste mes.
        const existing = await this.commissionsRepository.query(
          `SELECT id FROM commissions
           WHERE technician_id = $1 AND type = 'fixa' AND reference_month = $2
             AND regexp_replace(lower(trim(description)), '\\s+', ' ', 'g') = regexp_replace(lower(trim($3)), '\\s+', ' ', 'g')
           LIMIT 1`,
          [template.technicianId, refMonth, template.description || ''],
        );

        if (!existing.length) {
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
    }

    return { created, total };
  }

  private normalizeDescription(description: string): string {
    return (description || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  // Lista de meses "YYYY-MM" de start ate end, inclusive. Retorna vazio se start estiver
  // vazio/invalido ou for posterior a end (ex.: gerar um mes anterior ao template existir).
  private monthsBetween(start: string, end: string): string[] {
    // Sem referenceMonth valido no template (dado legado), volta ao comportamento anterior de
    // so considerar o mes alvo, em vez de nao gerar nada.
    if (!start || !/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end)) return [end];
    const [startYear, startMonthNum] = start.split('-').map(Number);
    const [endYear, endMonthNum] = end.split('-').map(Number);
    const months: string[] = [];
    let year = startYear;
    let monthNum = startMonthNum;
    while (year < endYear || (year === endYear && monthNum <= endMonthNum)) {
      months.push(`${year}-${String(monthNum).padStart(2, '0')}`);
      monthNum++;
      if (monthNum > 12) { monthNum = 1; year++; }
    }
    return months;
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
