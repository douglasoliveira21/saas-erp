import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GlpiTicket } from './entities/glpi-ticket.entity';
import { GlpiConfig } from './entities/glpi-config.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { SlaMonthlySnapshot } from './entities/sla-monthly-snapshot.entity';
import { decryptField, encryptField, isEncryptedField, maskSecret, requireEncryptionSecret } from '../../common/security/field-encryption';

@Injectable()
export class GlpiService implements OnModuleInit {
  private readonly credentialKey = requireEncryptionSecret('CREDENTIAL_ENCRYPTION_KEY');
  private readonly previousCredentialKey = process.env.CREDENTIAL_ENCRYPTION_KEY_PREVIOUS || '';
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
    @InjectRepository(SlaMonthlySnapshot)
    private snapshotsRepository: Repository<SlaMonthlySnapshot>,
  ) {}

  async onModuleInit(): Promise<void> {
    const config = await this.configRepository.findOne({ where: {} });
    if (!config) return;
    let changed = false;
    for (const field of ['appToken', 'userToken'] as const) {
      const value = config[field];
      if (!value) continue;
      if (!isEncryptedField(value)) {
        config[field] = encryptField(value, this.credentialKey);
        changed = true;
      } else {
        try {
          decryptField(value, [this.credentialKey]);
        } catch {
          const plainValue = decryptField(value, [this.previousCredentialKey]);
          config[field] = encryptField(plainValue, this.credentialKey);
          changed = true;
        }
      }
    }
    if (config.sessionToken) {
      config.sessionToken = null;
      changed = true;
    }
    if (changed) await this.configRepository.save(config);
  }

  private async getConfig(): Promise<GlpiConfig> {
    const config = await this.configRepository.findOne({ where: {} });
    if (!config) throw new Error('Configuracao GLPI nao encontrada');
    const keys = [this.credentialKey, this.previousCredentialKey];
    return {
      ...config,
      appToken: decryptField(config.appToken, keys),
      userToken: config.userToken ? decryptField(config.userToken, keys) : null,
      sessionToken: null,
    } as GlpiConfig;
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

  private async glpiWrite(path: string, sessionToken: string, config: GlpiConfig, input: any): Promise<any> {
    const res = await fetch(config.apiUrl + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'App-Token': config.appToken, 'Session-Token': sessionToken },
      body: JSON.stringify({ input }),
    });
    if (!res.ok) throw new Error('Erro GLPI ' + path + ': ' + await res.text());
    return res.json();
  }

  async createPortalTicket(input: { entityId: number; glpiUserId?: number | null; requesterName: string; requesterEmail: string; title: string; description: string; type: number; urgency: number }): Promise<{ id: number }> {
    const config = await this.getConfig();
    const session = await this.initSession(config);
    const payload: any = {
      name: input.title,
      content: `${input.description}\n\nSolicitante do portal: ${input.requesterName} <${input.requesterEmail}>`,
      entities_id: input.entityId, type: input.type, urgency: input.urgency, status: 1,
    };
    if (input.glpiUserId) payload._users_id_requester = input.glpiUserId;
    const result = await this.glpiWrite('/Ticket', session, config, payload);
    const id = Number(result?.id);
    if (!id) throw new Error('GLPI não retornou o identificador do chamado');
    return { id };
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

  private businessHours(start: Date | null, end: Date | null): number {
    if (!start || !end || end <= start) return 0;
    let total = 0; const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cursor < end) {
      const day = cursor.getDay();
      if (day >= 1 && day <= 5) {
        const workStart = new Date(cursor); workStart.setHours(8,0,0,0);
        const workEnd = new Date(cursor); workEnd.setHours(18,0,0,0);
        total += Math.max(0, Math.min(end.getTime(), workEnd.getTime()) - Math.max(start.getTime(), workStart.getTime()));
      }
      cursor.setDate(cursor.getDate()+1);
    }
    return total / 3600000;
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

        for (let start = 0; ; start += pageSize) {
          if (start >= 1000000) throw new Error('Limite de segurança de sincronização atingido');
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
          const elapsedHours = dateOpened && dateSolved ? Math.max(0, (dateSolved.getTime() - dateOpened.getTime()) / 3600000) : 0;
          const actionTimeSeconds = Number(ticket.actiontime || ticket.action_time || 0);
          let timeSpent = actionTimeSeconds > 0 ? actionTimeSeconds / 3600 : elapsedHours;

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
          const calculationMode = ticketContract?.slaCalculationMode || 'glpi_actiontime';
          if (calculationMode === 'elapsed') timeSpent = elapsedHours;
          else if (calculationMode === 'business_hours') timeSpent = this.businessHours(dateOpened, dateSolved);
          else timeSpent = actionTimeSeconds > 0 ? actionTimeSeconds / 3600 : elapsedHours;

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
            timeSource: calculationMode === 'glpi_actiontime' && actionTimeSeconds <= 0 ? 'elapsed_fallback' : calculationMode,
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

        const contractWithinValidity = customerContracts
          .filter(contract => {
            const start = new Date(contract.startDate + 'T00:00:00');
            const end = contract.endDate ? new Date(contract.endDate + 'T23:59:59.999') : null;
            return ticketDate >= start && (!end || ticketDate <= end);
          })
          .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];

        const activeContract = customerContracts
          .filter(contract => contract.status === 'ativo')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

        const matchingContract = contractWithinValidity || activeContract;
        if (matchingContract) ticket.contractId = matchingContract.id;
      }

      const linkedTickets = unlinkedTickets.filter(ticket => ticket.contractId);
      if (linkedTickets.length > 0) await this.ticketsRepository.save(linkedTickets);
    }

    for (const contract of contracts) {
      await this.recalculateContractSla(contract);
    }
  }
  private monthBounds(month: string): { start: Date; end: Date } | null {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) return null;
    const [year, value] = month.split('-').map(Number);
    return { start: new Date(year, value - 1, 1), end: new Date(year, value, 1) };
  }

  private allocatedHours(ticket: GlpiTicket, month: string): number {
    const bounds = this.monthBounds(month);
    if (!bounds) return Math.max(0, Number(ticket.timeSpentHours || 0));
    const opened = ticket.dateOpened || ticket.dateSolved || ticket.dateClosed;
    const solved = ticket.dateSolved || ticket.dateClosed || ticket.dateOpened;
    if (!opened || !solved) return 0;
    const totalMs = Math.max(0, solved.getTime() - opened.getTime());
    const overlapMs = Math.max(0, Math.min(solved.getTime(), bounds.end.getTime()) - Math.max(opened.getTime(), bounds.start.getTime()));
    if (totalMs === 0) return opened >= bounds.start && opened < bounds.end ? Math.max(0, Number(ticket.timeSpentHours || 0)) : 0;
    return Number((Math.max(0, Number(ticket.timeSpentHours || 0)) * overlapMs / totalMs).toFixed(2));
  }

  async getTickets(filters?: { customerId?: string; exceeded?: boolean; month?: string }): Promise<GlpiTicket[]> {
    const qb = this.ticketsRepository.createQueryBuilder('t').leftJoinAndSelect('t.customer', 'customer').leftJoinAndSelect('t.contract', 'contract').orderBy('t.dateOpened', 'ASC');
    if (filters?.customerId) qb.andWhere('t.customer_id = :cid', { cid: filters.customerId });
    this.applyMonthFilter(qb, filters?.month);
    const tickets = await qb.getMany();
    const grouped = new Map<string, GlpiTicket[]>();
    for (const ticket of tickets) {
      ticket.timeSpentHours = filters?.month ? this.allocatedHours(ticket, filters.month) : Number(ticket.timeSpentHours || 0);
      const key = ticket.contractId || 'customer:' + ticket.customerId;
      grouped.set(key, [...(grouped.get(key) || []), ticket]);
    }
    for (const items of grouped.values()) {
      const included = Math.max(0, Number(items[0]?.contract?.slaTotalHours || 0));
      const rate = Math.max(0, Number(items[0]?.contract?.slaOverageRate || 0));
      let consumed = 0; let previousOverflow = 0;
      for (const ticket of items) {
        consumed = Number((consumed + Number(ticket.timeSpentHours || 0)).toFixed(2));
        const cumulative = included > 0 ? Math.max(0, consumed - included) : 0;
        ticket.exceededHours = Number(Math.max(0, cumulative - previousOverflow).toFixed(2));
        ticket.slaExceeded = ticket.exceededHours > 0;
        ticket.slaLimitHours = included;
        ticket.chargeRate = rate;
        ticket.exceededCharge = Number((ticket.exceededHours * rate).toFixed(2));
        previousOverflow = cumulative;
      }
    }
    const result = filters?.exceeded ? tickets.filter(ticket => ticket.slaExceeded) : tickets;
    return result.sort((a, b) => (b.dateOpened?.getTime() || 0) - (a.dateOpened?.getTime() || 0));
  }

  async getSlaReport(month?: string, customerId?: string): Promise<any> {
    const targetMonth = month && this.monthBounds(month) ? month : new Date().toISOString().slice(0, 7);
    await this.recalculateStoredContractSlas(customerId);
    const tickets = await this.getTickets({ customerId, month: targetMonth });
    const byCustomer: Record<string, any> = {};
    for (const ticket of tickets) {
      const cid = ticket.customerId || 'sem-cliente';
      if (!byCustomer[cid]) byCustomer[cid] = { customerId: cid, contractId: ticket.contractId || null, name: ticket.customer?.name || 'Sem cliente', tickets: 0, exceeded: 0, consumedHours: 0, includedHours: Number(ticket.contract?.slaTotalHours || 0), exceededHours: 0, overageRate: Number(ticket.contract?.slaOverageRate || 0), charge: 0, details: [] };
      const item = byCustomer[cid];
      item.tickets++; item.consumedHours += Number(ticket.timeSpentHours || 0);
      item.details.push({ ticketId: ticket.id, glpiTicketId: ticket.glpiTicketId, openedAt: ticket.dateOpened, solvedAt: ticket.dateSolved || ticket.dateClosed, allocatedHours: Number(ticket.timeSpentHours || 0), timeSource: ticket.timeSource, exceededHours: Number(ticket.exceededHours || 0), charge: Number(ticket.exceededCharge || 0) });
      if (ticket.slaExceeded) { item.exceeded++; item.exceededHours += Number(ticket.exceededHours || 0); item.charge += Number(ticket.exceededCharge || 0); }
    }
    const currentMonth = new Date().toISOString().slice(0, 7);
    for (const item of Object.values(byCustomer) as any[]) {
      item.consumedHours = Number(item.consumedHours.toFixed(2)); item.exceededHours = Number(item.exceededHours.toFixed(2)); item.charge = Number(item.charge.toFixed(2));
      const existing = await this.snapshotsRepository.findOne({ where: { month: targetMonth, customerId: item.customerId, contractId: item.contractId } });
      if (existing?.isFrozen) {
        item.tickets = existing.ticketCount; item.consumedHours = Number(existing.consumedHours); item.includedHours = Number(existing.includedHours); item.exceededHours = Number(existing.exceededHours); item.overageRate = Number(existing.overageRate); item.charge = Number(existing.totalCharge); item.exceeded = (existing.calculationDetails || []).filter((detail: any) => Number(detail.exceededHours) > 0).length; item.details = existing.calculationDetails || [];
      } else {
        const snapshot = existing || this.snapshotsRepository.create({ month: targetMonth, customerId: item.customerId, contractId: item.contractId });
        Object.assign(snapshot, { includedHours: item.includedHours, consumedHours: item.consumedHours, exceededHours: item.exceededHours, overageRate: item.overageRate, totalCharge: item.charge, ticketCount: item.tickets, calculationDetails: item.details, isFrozen: targetMonth < currentMonth });
        await this.snapshotsRepository.save(snapshot);
      }
      delete item.details; delete item.customerId; delete item.contractId;
    }
    const summary = Object.values(byCustomer).sort((a: any, b: any) => b.charge - a.charge) as any[];
    return { totalTickets: summary.reduce((sum, item) => sum + item.tickets, 0), totalExceeded: summary.reduce((sum, item) => sum + item.exceeded, 0), totalConsumedHours: Number(summary.reduce((sum, item) => sum + item.consumedHours, 0).toFixed(2)), totalExceededHours: Number(summary.reduce((sum, item) => sum + item.exceededHours, 0).toFixed(2)), contractsWithoutAllowance: summary.filter(item => item.includedHours <= 0).length, totalCharge: Number(summary.reduce((sum, item) => sum + item.charge, 0).toFixed(2)), byCustomer: summary };
  }

  private applyMonthFilter(qb: any, month?: string, alias = 't'): void {
    const bounds = month ? this.monthBounds(month) : null;
    if (!bounds) return;
    qb.andWhere(alias + '.date_opened < :monthEnd AND COALESCE(' + alias + '.date_solved, ' + alias + '.date_closed, ' + alias + '.date_opened) >= :monthStart', { monthStart: bounds.start, monthEnd: bounds.end });
  }
  async getConfig2(): Promise<Partial<GlpiConfig> | null> {
    const config = await this.configRepository.findOne({ where: {} });
    if (!config) return null;
    return { id: config.id, apiUrl: config.apiUrl, appToken: maskSecret(config.appToken), userToken: maskSecret(config.userToken), lastSync: config.lastSync, createdAt: config.createdAt };
  }

  async updateConfig(dto: any): Promise<Partial<GlpiConfig>> {
    let config = await this.configRepository.findOne({ where: {} });
    const isMasked = (value: unknown) => typeof value === 'string' && /^\*+$/.test(value);
    if (!config) {
      if (!dto.appToken || isMasked(dto.appToken)) throw new Error('App Token e obrigatorio');
      config = this.configRepository.create({ apiUrl: dto.apiUrl, appToken: encryptField(dto.appToken, this.credentialKey), userToken: dto.userToken && !isMasked(dto.userToken) ? encryptField(dto.userToken, this.credentialKey) : null, sessionToken: null });
    } else {
      if (dto.apiUrl !== undefined) config.apiUrl = dto.apiUrl;
      if (dto.appToken && !isMasked(dto.appToken)) config.appToken = encryptField(dto.appToken, this.credentialKey);
      if (dto.userToken !== undefined && !isMasked(dto.userToken)) config.userToken = dto.userToken ? encryptField(dto.userToken, this.credentialKey) : null;
      config.sessionToken = null;
    }
    const saved = await this.configRepository.save(config);
    return { id: saved.id, apiUrl: saved.apiUrl, appToken: maskSecret(saved.appToken), userToken: maskSecret(saved.userToken), lastSync: saved.lastSync, createdAt: saved.createdAt };
  }
}
