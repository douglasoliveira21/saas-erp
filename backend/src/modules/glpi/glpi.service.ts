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

  async syncTickets(): Promise<{ synced: number; exceeded: number; totalCharge: number; failedEntities: Array<{ entityId: number; customer: string; error: string }> }> {
    const config = await this.getConfig();
    let session: string;
    try {
      session = await this.initSession(config);
    } catch (e) {
      this.logger.error('Falha ao conectar GLPI: ' + e.message);
      throw e;
    }

    const customers = await this.customersRepository.find({ where: {} });
    const customersByEntity = new Map<number, Customer>();
    for (const customer of customers) {
      if (customer.glpiEntityId != null) customersByEntity.set(Number(customer.glpiEntityId), customer);
    }

    let synced = 0;
    let exceeded = 0;
    let totalCharge = 0;
    const failedEntities: Array<{ entityId: number; customer: string; error: string }> = [];
    const pageSize = 200;

    for (const [entityId, customer] of customersByEntity.entries()) {
      try {
        const ticketsById = new Map<number, any>();

        for (let start = 0; start < 20000; start += pageSize) {
          const end = start + pageSize - 1;
          const payload = await this.glpiRequest(
            '/Ticket',
            session,
            config,
            `searchText[entities_id]=${entityId}&range=${start}-${end}&order=DESC`,
          );
          const page = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
              ? payload.data
              : payload?.data && typeof payload.data === 'object'
                ? Object.values(payload.data)
                : [];

          for (const ticket of page as any[]) {
            if (ticket?.id != null) ticketsById.set(Number(ticket.id), ticket);
          }
          if (page.length < pageSize) break;
        }

        const ticketList = Array.from(ticketsById.values()).filter((ticket: any) =>
          (Number(ticket.status) === 5 || Number(ticket.status) === 6) &&
          Number(ticket.entities_id) === entityId,
        );

        const contract = await this.contractsRepository.findOne({
          where: { customerId: customer.id, status: 'ativo' },
          order: { createdAt: 'DESC' },
        });

        for (const ticket of ticketList) {
          const parseDate = (value: unknown): Date | null => {
            if (!value) return null;
            const date = new Date(String(value));
            return Number.isNaN(date.getTime()) ? null : date;
          };

          const dateOpened = parseDate(ticket.date);
          const dateSolved = parseDate(ticket.solvedate) || parseDate(ticket.closedate);
          const dateClosed = parseDate(ticket.closedate);
          const timeSpent = dateOpened && dateSolved
            ? Math.max(0, (dateSolved.getTime() - dateOpened.getTime()) / (1000 * 60 * 60))
            : 0;

          const type = Number(ticket.type);
          const slaType = type === 2 ? 'externo' : 'interno';
          const slaLimit = contract
            ? (slaType === 'interno' ? contract.slaInternal : contract.slaExternal)
            : (slaType === 'interno' ? 4 : 24);
          const slaExceeded = timeSpent > slaLimit;
          const exceededHours = slaExceeded ? Math.ceil(timeSpent - slaLimit) : 0;
          const chargeRate = 80;
          const exceededCharge = exceededHours * chargeRate;

          let savedTicket = await this.ticketsRepository.findOne({
            where: { glpiTicketId: Number(ticket.id) },
          });

          if (!savedTicket) {
            savedTicket = this.ticketsRepository.create({
              glpiTicketId: Number(ticket.id),
              customerId: customer.id,
              contractId: contract?.id || null,
              glpiEntityId: entityId,
            });
          }

          Object.assign(savedTicket, {
            customerId: customer.id,
            contractId: contract?.id || null,
            glpiEntityId: entityId,
            title: ticket.name || ticket.title || `Chamado #${ticket.id}`,
            status: Number(ticket.status),
            type,
            priority: ticket.priority != null ? Number(ticket.priority) : null,
            dateOpened,
            dateSolved,
            dateClosed,
            slaType,
            slaLimitHours: slaLimit,
            timeSpentHours: Number(timeSpent.toFixed(2)),
            slaExceeded,
            exceededHours,
            exceededCharge,
            chargeRate,
            syncedAt: new Date(),
          });
          await this.ticketsRepository.save(savedTicket);

          synced++;
          if (slaExceeded) {
            exceeded++;
            totalCharge += exceededCharge;
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        failedEntities.push({ entityId, customer: customer.name, error: message });
        this.logger.error(`Erro ao sincronizar entidade ${entityId} (${customer.name}): ${message}`);
      }
    }

    await this.configRepository.update(config.id, { lastSync: new Date() });
    return { synced, exceeded, totalCharge, failedEntities };
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

  async getConfig2(): Promise<GlpiConfig | null> {
    const config = await this.configRepository.findOne({ where: {} });
    return config;
  }

  async updateConfig(dto: any): Promise<GlpiConfig> {
    let config = await this.configRepository.findOne({ where: {} });

    if (!config) {
      // Criar config se não existe
      config = this.configRepository.create({
        apiUrl: dto.apiUrl,
        appToken: dto.appToken,
        userToken: dto.userToken || null,
      });
    } else {
      Object.assign(config, dto);
    }

    return this.configRepository.save(config);
  }
}
