import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Customer } from '../customers/entities/customer.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { GlpiTicket } from '../glpi/entities/glpi-ticket.entity';
import { GlpiService } from '../glpi/glpi.service';
import { PortalUser } from './entities/portal-user.entity';
import { PortalTicketForm } from './entities/portal-form.entity';
import { PortalTicket } from './entities/portal-ticket.entity';

@Injectable()
export class CustomerPortalService {
  constructor(
    @InjectRepository(PortalUser) private users: Repository<PortalUser>,
    @InjectRepository(PortalTicketForm) private forms: Repository<PortalTicketForm>,
    @InjectRepository(PortalTicket) private tickets: Repository<PortalTicket>,
    @InjectRepository(Customer) private customers: Repository<Customer>,
    @InjectRepository(Contract) private contracts: Repository<Contract>,
    @InjectRepository(GlpiTicket) private glpiTickets: Repository<GlpiTicket>,
    private glpi: GlpiService, private jwt: JwtService, private dataSource: DataSource,
  ) {}

  private digits(value = '') { return value.replace(/\D/g, ''); }
  private safe(user: PortalUser) { const { password, ...result } = user; return result; }

  async findCompany(cnpj: string) {
    const normalized = this.digits(cnpj);
    if (normalized.length !== 14) throw new BadRequestException('Informe um CNPJ válido');
    const customer = (await this.customers.find({ where: { active: true } }))
      .find(item => this.digits(item.cpfCnpj) === normalized);
    if (!customer) throw new NotFoundException('Empresa não encontrada no cadastro');
    if (!customer.glpiEntityId) throw new BadRequestException('Empresa ainda não possui entidade GLPI vinculada');
    return { id: customer.id, name: customer.name, cnpj: normalized.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') };
  }

  async selfRegister(body: any) {
    const company = await this.findCompany(body.cnpj);
    const email = String(body.email || '').trim().toLowerCase();
    if (!String(body.name || '').trim() || !email || String(body.password || '').length < 8)
      throw new BadRequestException('Nome, e-mail e senha com pelo menos 8 caracteres são obrigatórios');
    if (await this.users.findOne({ where: { email } })) throw new BadRequestException('E-mail já cadastrado');
    const user = await this.users.save(this.users.create({
      customerId: company.id, name: String(body.name).trim(), email, phone: body.phone,
      department: body.department, password: await bcrypt.hash(body.password, 12), role: 'user', status: 'pending',
    }));
    return { message: 'Cadastro enviado para aprovação do administrador da empresa', user: this.safe(user) };
  }

  async login(email: string, password: string) {
    const user = await this.users.findOne({ where: { email: String(email || '').trim().toLowerCase() }, relations: ['customer'] });
    if (!user || !await bcrypt.compare(password || '', user.password)) throw new UnauthorizedException('Credenciais inválidas');
    if (user.status !== 'active') throw new ForbiddenException(user.status === 'pending' ? 'Cadastro aguardando aprovação' : 'Usuário bloqueado');
    await this.users.update(user.id, { lastLoginAt: new Date() });
    const accessToken = this.jwt.sign({ sub: user.id, customerId: user.customerId, role: user.role, aud: 'customer-portal' }, { expiresIn: '7d' });
    return { accessToken, user: { ...this.safe(user), customer: { id: user.customer.id, name: user.customer.name } } };
  }

  async me(id: string) {
    const user = await this.users.findOne({ where: { id }, relations: ['customer'] });
    if (!user || user.status !== 'active') throw new UnauthorizedException();
    return { ...this.safe(user), customer: { id: user.customer.id, name: user.customer.name } };
  }

  async listUsers(actor?: any, customerId?: string) {
    const target = actor?.customerId || customerId;
    const rows = target
      ? await this.users.find({ where: { customerId: target }, relations: ['customer'], order: { createdAt: 'DESC' } })
      : await this.users.find({ relations: ['customer'], order: { createdAt: 'DESC' } });
    return rows.map(user => this.safe(user));
  }

  async createUser(body: any, approvedBy: string, actor?: any) {
    const customerId = actor?.customerId || body.customerId;
    if (actor && actor.role !== 'admin') throw new ForbiddenException();
    const customer = await this.customers.findOne({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Cliente não encontrado');
    const email = String(body.email || '').trim().toLowerCase();
    if (await this.users.findOne({ where: { email } })) throw new BadRequestException('E-mail já cadastrado');
    const password = String(body.password || '');
    if (password.length < 8) throw new BadRequestException('Informe uma senha provisória com pelo menos 8 caracteres');
    const user = await this.users.save(this.users.create({
      customerId, name: body.name, email, phone: body.phone, department: body.department,
      password: await bcrypt.hash(password, 12), role: ['admin','manager','finance','user'].includes(body.role) ? body.role : 'user',
      status: 'active', approvedAt: new Date(), approvedBy,
    }));
    return this.safe(user);
  }

  async updateUser(id: string, body: any, approvedBy: string, actor?: any) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException();
    if (actor?.customerId && actor.customerId !== user.customerId) throw new ForbiddenException();
    if (actor && actor.role !== 'admin') throw new ForbiddenException();
    const patch: any = {};
    for (const field of ['name','phone','department','status','role','glpiUserId']) if (body[field] !== undefined) patch[field] = body[field];
    if (body.status === 'active' && user.status !== 'active') { patch.approvedAt = new Date(); patch.approvedBy = approvedBy; }
    await this.users.update(id, patch);
    return this.safe(await this.users.findOneOrFail({ where: { id } }));
  }

  async getForm(customerId: string) {
    return await this.forms.findOne({ where: { customerId, active: true } })
      || await this.forms.findOne({ where: { customerId: IsNull(), active: true } })
      || { id: 'default', name: 'Abrir chamado', fields: [
        { key: 'title', label: 'Assunto', type: 'text', required: true },
        { key: 'description', label: 'Descrição', type: 'textarea', required: true },
        { key: 'type', label: 'Tipo', type: 'select', required: true, options: ['Incidente','Requisição'] },
        { key: 'urgency', label: 'Urgência', type: 'select', required: true, options: ['Baixa','Média','Alta'] },
      ]};
  }

  async saveForm(body: any) {
    let form = body.id && body.id !== 'default' ? await this.forms.findOne({ where: { id: body.id } }) : null;
    if (!form) form = this.forms.create();
    Object.assign(form, { name: body.name || 'Formulário padrão', customerId: body.customerId || null, active: body.active !== false, fields: Array.isArray(body.fields) ? body.fields : [] });
    return this.forms.save(form);
  }

  async createTicket(actor: any, body: any) {
    const user = await this.users.findOne({ where: { id: actor.sub }, relations: ['customer'] });
    if (!user || user.status !== 'active') throw new UnauthorizedException();
    if (!user.customer.glpiEntityId) throw new BadRequestException('Empresa sem entidade GLPI vinculada');
    const title = String(body.title || '').trim(), description = String(body.description || '').trim();
    if (!title || !description) throw new BadRequestException('Assunto e descrição são obrigatórios');
    const result = await this.glpi.createPortalTicket({
      entityId: user.customer.glpiEntityId, glpiUserId: user.glpiUserId,
      requesterName: user.name, requesterEmail: user.email, title, description,
      type: Number(body.type) === 2 ? 2 : 1, urgency: Math.min(5, Math.max(1, Number(body.urgency) || 3)),
    });
    return this.tickets.save(this.tickets.create({
      customerId: user.customerId, portalUserId: user.id, glpiTicketId: result.id,
      glpiEntityId: user.customer.glpiEntityId, title, description,
      type: Number(body.type) === 2 ? 2 : 1, urgency: Number(body.urgency) || 3, formData: body.formData || {},
    }));
  }

  async listTickets(actor: any) {
    const where: any = { customerId: actor.customerId };
    if (actor.role === 'user') where.portalUserId = actor.sub;
    const local = await this.tickets.find({ where, relations: ['requester'], order: { createdAt: 'DESC' } });
    const synced = await this.glpiTickets.find({ where: { customerId: actor.customerId } });
    const states = new Map(synced.map(ticket => [ticket.glpiTicketId, ticket]));
    return local.map(ticket => ({ ...ticket, requester: this.safe(ticket.requester), status: states.get(ticket.glpiTicketId)?.status || ticket.status }));
  }

  async dashboard(actor: any) {
    const tickets = await this.listTickets(actor), month = new Date().toISOString().slice(0, 7);
    const contracts = await this.contracts.find({ where: { customerId: actor.customerId, status: 'ativo' } });
    const sla = await this.dataSource.query(`SELECT COALESCE(SUM(time_spent_hours),0)::numeric consumed, COALESCE(SUM(exceeded_hours),0)::numeric exceeded, COALESCE(SUM(exceeded_charge),0)::numeric charge FROM glpi_tickets WHERE customer_id=$1 AND TO_CHAR(COALESCE(date_solved,date_closed,date_opened),'YYYY-MM')=$2`, [actor.customerId, month]);
    return {
      tickets: { total: tickets.length, open: tickets.filter((item: any) => ![5,6].includes(Number(item.status))).length },
      sla: { included: Number(contracts[0]?.slaTotalHours || 0), consumed: Number(sla[0]?.consumed || 0), exceeded: Number(sla[0]?.exceeded || 0), charge: Number(sla[0]?.charge || 0), month },
      contracts: contracts.length,
    };
  }

  async documents(actor: any) {
    if (!['admin','finance'].includes(actor.role)) throw new ForbiddenException();
    const receivables = await this.dataSource.query(`SELECT ar.id,ar.description,ar.total_value "totalValue",ar.pending_value "pendingValue",ar.status,ar.due_date "dueDate",p.type,p.codigo_solicitacao "code" FROM accounts_receivable ar LEFT JOIN payments p ON p.sale_id=ar.sale_id WHERE ar.customer_id=$1 ORDER BY ar.due_date DESC LIMIT 100`, [actor.customerId]);
    const invoices = await this.dataSource.query(`SELECT i.id,i.type,i.number,i.status,i.issued_at "issuedAt",s.total_amount "totalValue" FROM invoices i JOIN sales s ON s.id=i.sale_id WHERE s.customer_id=$1 ORDER BY i.created_at DESC LIMIT 100`, [actor.customerId]);
    const contracts = await this.contracts.find({ where: { customerId: actor.customerId }, order: { createdAt: 'DESC' } });
    return { receivables, invoices, contracts };
  }
}
