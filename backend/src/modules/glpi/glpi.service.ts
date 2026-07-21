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
    const affectedContracts = new Map<string, Contract>();

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
        if (contract) affectedContracts.set(contract.id, contract);

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
          const contractStart = contract ? new Date(contract.startDate + 'T00:00:00') : null;
          const contractEnd = contract?.endDate ? new Date(contract.endDate + 'T23:59:59.999') : null;
          const isWithinContract = Boolean(
            contract && dateOpened &&
            (!contractStart || dateOpened >= contractStart) &&
            (!contractEnd || dateOpened <= contractEnd),
          );
          const ticketContract = isWithinContract ? contract : null;

          let savedTicket = await this.ticketsRepository.findOne({
            where: { glpiTicketId: Number(ticket.id) },
          });

          if (!savedTicket) {
            savedTicket = this.ticketsRepository.create({
              glpiTicketId: Number(ticket.id),
              customerId: customer.id,
              contractId: ticketContract?.id || null,
              glpiEntityId: entityId,
            });
          }

          Object.assign(savedTicket, {
            customerId: customer.id,
            contractId: ticketContract?.id || null,
            glpiEntityId: entityId,
            title: ticket.name || ticket.title || `Chamado #${ticket.id}`,
            status: Number(ticket.status),
            type,
            priority: ticket.priority != null ? Number(ticket.priority) : null,
            dateOpened,
            dateSolved,
            dateClosed,
            slaType,
            slaLimitHours: Number(ticketContract?.slaTotalHours || 0),
            timeSpentHours: Number(timeSpent.toFixed(2)),
            slaExceeded: false,
            exceededHours: 0,
            exceededCharge: 0,
            chargeRate: Number(ticketContract?.slaOverageRate || 0),
            syncedAt: new Date(),
          });
          await this.ticketsRepository.save(savedTicket);

          synced++;
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        failedEntities.push({ entityId, customer: customer.name, error: message });
        this.logger.error(`Erro ao sincronizar entidade ${entityId} (${customer.name}): ${message}`);
      }
    }

    for (const contract of affectedContracts.values()) {
      const result = await this.recalculateContractSla(contract);
      exceeded += result.exceeded;
      totalCharge += result.totalCharge;
    }

    await this.configRepository.update(config.id, { lastSync: new Date() });
    return { synced, exceeded, totalCharge, failedEntities };
  }

  private async recalculateContractSla(contract: Contract): Promise<{ exceeded: number; totalCharge: number }> {
    const tickets = await this.ticketsRepository.createQueryBuilder('ticket')
      .where('ticket.contract_id = :contractId', { contractId: contract.id })
      .orderBy('COALESCE(ticket.date_solved, ticket.date_closed, ticket.date_opened)', 'ASC')
      .addOrderBy('ticket.glpi_ticket_id', 'ASC')
      .getMany();

    const includedHours = Math.max(0, Number(contract.slaTotalHours || 0));
    const chargeRate = Math.max(0, Number(contract.slaOverageRate || 0));
    let consumedHours = 0;
    let previousOverflow = 0;
    let currentMonth = '';
    let exceeded = 0;
    let totalCharge = 0;

    for (const ticket of tickets) {
      const referenceDate = ticket.dateSolved || ticket.dateClosed || ticket.dateOpened;
      const ticketMonth = referenceDate
        ? referenceDate.getFullYear() + '-' + String(referenceDate.getMonth() + 1).padStart(2, '0')
        : 'sem-data';
      if (ticketMonth !== currentMonth) {
        currentMonth = ticketMonth;
        consumedHours = 0;
        previousOverflow = 0;
      }

      consumedHours += Math.max(0, Number(ticket.timeSpentHours || 0));
      const cumulativeOverflow = includedHours > 0 ? Math.max(0, consumedHours - includedHours) : 0;
      const ticketOverflow = Math.max(0, cumulativeOverflow - previousOverflow);
      const roundedOverflow = Number(ticketOverflow.toFixed(2));
      const charge = Number((roundedOverflow * chargeRate).toFixed(2));

      ticket.slaLimitHours = includedHours;
      ticket.slaExceeded = roundedOverflow > 0;
      ticket.exceededHours = roundedOverflow;
      ticket.exceededCharge = charge;
      ticket.chargeRate = chargeRate;

      if (ticket.slaExceeded) exceeded++;
      totalCharge += charge;
      previousOverflow = cumulativeOverflow;
    }

    if (tickets.length > 0) await this.ticketsRepository.save(tickets);
    return { exceeded, totalCharge: Number(totalCharge.toFixed(2)) };
  }

  private async recalculateStoredContractSlas(customerId?: string): Promise<void> {
    const contracts = customerId
      ? await this.contractsRepository.find({ where: { customerId } })
      : await this.contractsRepository.find({ where: {} });

    const contractsByCustomer = new Map<string, Contract[]>();
    for (const contract of contracts) {
      const customerContracts = contractsByCustomer.get(contract.customerId) || [];
      customerContracts.push(contract);
      contractsByCustomer.set(contract.customerId, customerContracts);
    }

    for (const [contractCustomerId, customerContracts] of contractsByCustomer) {
      const unlinkedTickets = await this.ticketsRepository.createQueryBuilder('ticket')
        .where('ticket.customer_id = :customerId', { customerId: contractCustomerId })
        .andWhere('ticket.contract_id IS NULL')
        .getMany();

      for (const ticket of unlinkedTickets) {
        const ticketDate = ticket.dateOpened || ticket.dateSolved || ticket.dateClosed;
        if (!ticketDate) continue;

        const matchingContract = customerContracts
          .filter(contract => {
            const start = new Date(contract.startDate + 'T00:00:00');
            const end = contract.endDate ? new Date(contract.endDate + 'T23:59:59.999') : null;
            return ticketDate >= start && (!end || ticketDate <= end);
          })
          .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];

        if (matchingContract) ticket.contractId = matchingContract.id;
      }

      const linkedTickets = unlinkedTickets.filter(ticket => ticket.contractId);
      if (linkedTickets.length > 0) await this.ticketsRepository.save(linkedTickets);
    }

    for (const contract of contracts) {
      await this.recalculateContractSla(contract);
    }
  }
  async getTickets(filters?: { customerId?: string; exceeded?: boolean; month?: string }): Promise<GlpiTicket[]> {
    const qb = this.ticketsRepository.createQueryBuilder('t')
      .leftJoinAndSelect('t.customer', 'customer')
      .leftJoinAndSelect('t.contract', 'contract')
      .orderBy('t.dateOpened', 'DESC');

    if (filters?.customerId) qb.andWhere('t.customer_id = :cid', { cid: filters.customerId });
    if (filters?.exceeded) qb.andWhere('t.sla_exceeded = true');
    this.applyMonthFilter(qb, filters?.month);

    return qb.getMany();
  }

  async getSlaReport(month?: string, customerId?: string): Promise<any> {
    await this.recalculateStoredContractSlas(customerId);
    const qb = this.ticketsRepository.createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.customer', 'customer')
      .leftJoinAndSelect('ticket.contract', 'contract');
    this.applyMonthFilter(qb, month, 'ticket');
    if (customerId) qb.andWhere('ticket.customer_id = :customerId', { customerId });
    const tickets = await qb.getMany();
    const exceeded = tickets.filter(t => t.slaExceeded);
    const totalCharge = exceeded.reduce((s, t) => s + Number(t.exceededCharge), 0);

    // Agrupar consumo da franquia e excedente por cliente
    const byCustomer: Record<string, {
      name: string;
      tickets: number;
      exceeded: number;
      consumedHours: number;
      includedHours: number;
      exceededHours: number;
      overageRate: number;
      charge: number;
    }> = {};
    for (const t of tickets) {
      const cid = t.customerId || 'sem-cliente';
      const name = t.customer?.name || 'Sem cliente';
      if (!byCustomer[cid]) {
        byCustomer[cid] = {
          name,
          tickets: 0,
          exceeded: 0,
          consumedHours: 0,
          includedHours: Number(t.contract?.slaTotalHours || 0),
          exceededHours: 0,
          overageRate: Number(t.contract?.slaOverageRate || 0),
          charge: 0,
        };
      }
      byCustomer[cid].tickets++;
      byCustomer[cid].consumedHours += Number(t.timeSpentHours || 0);
      byCustomer[cid].includedHours = Math.max(byCustomer[cid].includedHours, Number(t.contract?.slaTotalHours || 0));
      byCustomer[cid].overageRate = Math.max(byCustomer[cid].overageRate, Number(t.contract?.slaOverageRate || 0));
      if (t.slaExceeded) {
        byCustomer[cid].exceeded++;
        byCustomer[cid].exceededHours += Number(t.exceededHours || 0);
        byCustomer[cid].charge += Number(t.exceededCharge);
      }
    }

    for (const item of Object.values(byCustomer)) {
      item.consumedHours = Number(item.consumedHours.toFixed(2));
      item.exceededHours = Number(item.exceededHours.toFixed(2));
      item.charge = Number(item.charge.toFixed(2));
    }
    const customerSummary = Object.values(byCustomer).sort((a, b) => b.charge - a.charge);
    return {
      totalTickets: tickets.length,
      totalExceeded: exceeded.length,
      totalConsumedHours: Number(customerSummary.reduce((sum, item) => sum + item.consumedHours, 0).toFixed(2)),
      totalExceededHours: Number(customerSummary.reduce((sum, item) => sum + item.exceededHours, 0).toFixed(2)),
      contractsWithoutAllowance: customerSummary.filter(item => item.includedHours <= 0).length,
      totalCharge,
      byCustomer: customerSummary,
    };
  }
  private applyMonthFilter(qb: any, month?: string, alias = 't'): void {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return;
    const [year, monthNumber] = month.split('-').map(Number);
    if (monthNumber < 1 || monthNumber > 12) return;
    const start = new Date(year, monthNumber - 1, 1);
    const end = new Date(year, monthNumber, 1);
    const referenceColumn = 'COALESCE(' + alias + '.date_solved, ' + alias + '.date_closed, ' + alias + '.date_opened)';
    qb.andWhere(
      referenceColumn + ' >= :monthStart AND ' + referenceColumn + ' < :monthEnd',
      { monthStart: start, monthEnd: end },
    );
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
