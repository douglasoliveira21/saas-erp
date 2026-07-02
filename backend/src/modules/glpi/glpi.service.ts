import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GlpiTicket } from './entities/glpi-ticket.entity';
import { GlpiConfig } from './entities/glpi-config.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Contract } from '../contracts/entities/contract.entity';

@Injectable()
export class GlpiService {
  private readonly logger = new Logger(GlpiService.name);

  constructor(
    @InjectRepository(GlpiTicket)
    private ticketsRepository: Repository<GlpiTicket>,
    @InjectRepository(GlpiConfig)
    private configRepository: Repository<GlpiConfig>,
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
    @InjectRepository(Contract)
    private contractsRepository: Repository<Contract>,
  ) {}

  private async getConfig(): Promise<GlpiConfig> {
    const config = await this.configRepository.findOne({ where: {} });
    if (!config) throw new Error('Configuracao GLPI nao encontrada');
    return config;
  }

  private async initSession(config: GlpiConfig): Promise<string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'App-Token': config.appToken,
    };
    if (config.userToken) {
      headers['Authorization'] = 'user_token ' + config.userToken;
    }
    const res = await fetch(config.apiUrl + '/initSession', {
      method: 'GET',
      headers,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error('Erro ao iniciar sessao GLPI: ' + err);
    }
    const data = await res.json();
    return data.session_token;
  }

  private async glpiRequest(path: string, sessionToken: string, config: GlpiConfig, params?: string): Promise<any> {
    const url = config.apiUrl + path + (params ? '?' + params : '');
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'App-Token': config.appToken,
        'Session-Token': sessionToken,
      },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error('Erro GLPI ' + path + ': ' + err);
    }
    return res.json();
  }

  async getEntities(): Promise<any[]> {
    const config = await this.getConfig();
    const session = await this.initSession(config);
    try {
      const data = await this.glpiRequest('/Entity', session, config, 'range=0-200');
      const list = Array.isArray(data) ? data : data.data || [];
      return list.map((e: any) => ({ id: e.id, name: e.completename || e.name }));
    } catch (e) {
      this.logger.error('Erro ao buscar entidades: ' + e.message);
      return [];
    }
  }

  async syncTickets(): Promise<{ synced: number; exceeded: number; totalCharge: number }> {
    const config = await this.getConfig();
    let session: string;
    try {
      session = await this.initSession(config);
    } catch (e) {
      this.logger.error('Falha ao conectar GLPI: ' + e.message);
      throw e;
    }

    // Buscar clientes com entidade vinculada
    const customers = await this.customersRepository.find({ where: {} });
    const customersByEntity: Record<number, Customer> = {};
    for (const c of customers) {
      if ((c as any).glpiEntityId) customersByEntity[(c as any).glpiEntityId] = c;
    }

    let synced = 0;
    let exceeded = 0;
    let totalCharge = 0;

    // Para cada entidade vinculada, buscar chamados
    for (const [entityId, customer] of Object.entries(customersByEntity)) {
      try {
        // Buscar chamados solucionados (5) e fechados (6) da entidade
        const tickets = await this.glpiRequest(
          '/Ticket',
          session,
          config,
          'searchText[entities_id]=' + entityId + '&searchText[status]=5,6&range=0-200&order=DESC&sort=1'
        );

        let ticketList = Array.isArray(tickets) ? tickets : tickets.data || [];

        // Filtrar apenas status 5 (solucionado) e 6 (fechado) e entidade correta
        ticketList = ticketList.filter((t: any) =>
          (t.status === 5 || t.status === 6) &&
          (t.entities_id === parseInt(entityId as string) || !t.entities_id)
        );

        // Buscar contrato ativo do cliente
        const contract = await this.contractsRepository.findOne({
          where: { customerId: customer.id, status: 'ativo' },
          order: { createdAt: 'DESC' },
        });

        for (const ticket of ticketList) {
          // Verificar se ja existe
          let existing = await this.ticketsRepository.findOne({
            where: { glpiTicketId: ticket.id },
          });

          const dateOpened = ticket.date ? new Date(ticket.date) : null;
          const dateClosed = ticket.closedate ? new Date(ticket.closedate) : null;

          // Calcular tempo gasto (horas)
          let timeSpent = 0;
          if (dateOpened) {
            const end = dateClosed || new Date();
            timeSpent = (end.getTime() - dateOpened.getTime()) / (1000 * 60 * 60);
          }

          // Determinar tipo de SLA (interno/externo baseado no tipo do chamado GLPI)
          // type 1 = incidente, type 2 = requisicao
          const slaType = ticket.type === 2 ? 'externo' : 'interno';
          const slaLimit = contract
            ? (slaType === 'interno' ? contract.slaInternal : contract.slaExternal)
            : (slaType === 'interno' ? 4 : 24);

          // Calcular estouro
          const slaExceeded = timeSpent > slaLimit;
          const exceededHours = slaExceeded ? Math.ceil(timeSpent - slaLimit) : 0;
          const chargeRate = 80;
          const exceededCharge = exceededHours * chargeRate;

          if (existing) {
            existing.title = ticket.name || ticket.title || '';
            existing.status = ticket.status;
            existing.type = ticket.type;
            existing.priority = ticket.priority;
            existing.dateOpened = dateOpened;
            existing.dateClosed = dateClosed;
            existing.slaType = slaType;
            existing.slaLimitHours = slaLimit;
            existing.timeSpentHours = parseFloat(timeSpent.toFixed(2));
            existing.slaExceeded = slaExceeded;
            existing.exceededHours = exceededHours;
            existing.exceededCharge = exceededCharge;
            existing.syncedAt = new Date();
            await this.ticketsRepository.save(existing);
          } else {
            const newTicket = this.ticketsRepository.create({
              glpiTicketId: ticket.id,
              customerId: customer.id,
              contractId: contract?.id || null,
              glpiEntityId: parseInt(entityId as string),
              title: ticket.name || ticket.title || '',
              status: ticket.status,
              type: ticket.type,
              priority: ticket.priority,
              dateOpened,
              dateClosed,
              slaType,
              slaLimitHours: slaLimit,
              timeSpentHours: parseFloat(timeSpent.toFixed(2)),
              slaExceeded,
              exceededHours,
              exceededCharge,
              chargeRate,
              syncedAt: new Date(),
            });
            await this.ticketsRepository.save(newTicket);
          }

          synced++;
          if (slaExceeded) { exceeded++; totalCharge += exceededCharge; }
        }
      } catch (e) {
        this.logger.error('Erro ao sincronizar entidade ' + entityId + ': ' + e.message);
      }
    }

    // Atualizar last_sync
    await this.configRepository.update(config.id, { lastSync: new Date() });

    return { synced, exceeded, totalCharge };
  }

  async getTickets(filters?: { customerId?: string; exceeded?: boolean }): Promise<GlpiTicket[]> {
    const qb = this.ticketsRepository.createQueryBuilder('t')
      .leftJoinAndSelect('t.customer', 'customer')
      .leftJoinAndSelect('t.contract', 'contract')
      .orderBy('t.dateOpened', 'DESC');

    if (filters?.customerId) qb.andWhere('t.customer_id = :cid', { cid: filters.customerId });
    if (filters?.exceeded) qb.andWhere('t.sla_exceeded = true');

    return qb.getMany();
  }

  async getSlaReport(): Promise<any> {
    const tickets = await this.ticketsRepository.find({ relations: ['customer', 'contract'] });
    const exceeded = tickets.filter(t => t.slaExceeded);
    const totalCharge = exceeded.reduce((s, t) => s + Number(t.exceededCharge), 0);

    // Agrupar por cliente
    const byCustomer: Record<string, { name: string; tickets: number; exceeded: number; charge: number }> = {};
    for (const t of tickets) {
      const cid = t.customerId || 'sem-cliente';
      const name = t.customer?.name || 'Sem cliente';
      if (!byCustomer[cid]) byCustomer[cid] = { name, tickets: 0, exceeded: 0, charge: 0 };
      byCustomer[cid].tickets++;
      if (t.slaExceeded) {
        byCustomer[cid].exceeded++;
        byCustomer[cid].charge += Number(t.exceededCharge);
      }
    }

    return {
      totalTickets: tickets.length,
      totalExceeded: exceeded.length,
      totalCharge,
      byCustomer: Object.values(byCustomer).sort((a, b) => b.charge - a.charge),
    };
  }

  async getConfig2(): Promise<GlpiConfig> {
    return this.getConfig();
  }

  async updateConfig(dto: any): Promise<GlpiConfig> {
    const config = await this.getConfig();
    Object.assign(config, dto);
    return this.configRepository.save(config);
  }
}
