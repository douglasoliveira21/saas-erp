import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Customer } from '../customers/entities/customer.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { GlpiTicket } from '../glpi/entities/glpi-ticket.entity';
import { GlpiService } from '../glpi/glpi.service';
import { MailService } from '../mail/mail.service';
import { InterService } from '../inter/inter.service';
import { NfseService } from '../fiscal/services/nfse.service';
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
    private glpi: GlpiService, private jwt: JwtService, private dataSource: DataSource, private mail: MailService, private inter: InterService, private nfse: NfseService,
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
    const existing = await this.users.findOne({ where: { email } });
    if (existing?.status === 'active') throw new BadRequestException('E-mail já cadastrado');
    if (existing && existing.customerId !== company.id) throw new BadRequestException('E-mail já vinculado a outra empresa');
    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const data: Partial<PortalUser> = {
      customerId: company.id, name: String(body.name).trim(), email, phone: body.phone,
      department: body.department, password: await bcrypt.hash(body.password, 12), role: 'user', status: 'pending',
      verificationCodeHash: codeHash, verificationExpiresAt: new Date(Date.now() + 15 * 60000),
    };
    const user = existing ? await this.users.save(Object.assign(existing, data)) : await this.users.save(this.users.create(data));
    const sent = await this.mail.sendMail(email, 'Código de confirmação - Portal VGON', `<p>Olá, ${user.name}.</p><p>Seu código para confirmar o cadastro no Portal VGON é:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>O código expira em 15 minutos.</p>`);
    if (!sent) throw new BadRequestException('Não foi possível enviar o código. Confira o e-mail ou tente novamente.');
    return { message: 'Enviamos um código de confirmação para o seu e-mail.', verificationRequired: true, email };
  }

  async verifyEmail(emailValue: string, codeValue: string) {
    const email = String(emailValue || '').trim().toLowerCase();
    const codeHash = crypto.createHash('sha256').update(String(codeValue || '').trim()).digest('hex');
    const user = await this.users.findOne({ where: { email } });
    if (!user || user.status !== 'pending' || !user.verificationCodeHash || user.verificationCodeHash !== codeHash)
      throw new BadRequestException('Código inválido');
    if (!user.verificationExpiresAt || user.verificationExpiresAt < new Date())
      throw new BadRequestException('Código expirado. Faça o cadastro novamente para receber outro.');
    user.status = 'active'; user.approvedAt = new Date(); user.verificationCodeHash = null; user.verificationExpiresAt = null;
    await this.users.save(user);
    return { message: 'E-mail confirmado. Seu acesso ao portal está liberado.' };
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
    const localWhere: any = { customerId: actor.customerId };
    if (actor.role === 'user') localWhere.portalUserId = actor.sub;
    const local = await this.tickets.find({ where: localWhere, relations: ['requester'], order: { createdAt: 'DESC' } });
    const synced = await this.glpiTickets.find({ where: { customerId: actor.customerId }, order: { dateOpened: 'DESC' } });
    const states = new Map(synced.map(ticket => [ticket.glpiTicketId, ticket]));
    const result: any[] = local.map(ticket => ({ ...ticket, requester: this.safe(ticket.requester), status: states.get(ticket.glpiTicketId)?.status || ticket.status, dateOpened: states.get(ticket.glpiTicketId)?.dateOpened || ticket.createdAt }));
    if (actor.role !== 'user') {
      const localIds = new Set(local.map(ticket => ticket.glpiTicketId));
      for (const ticket of synced) if (!localIds.has(ticket.glpiTicketId)) result.push({
        id: `glpi-${ticket.glpiTicketId}`, glpiTicketId: ticket.glpiTicketId, customerId: ticket.customerId,
        title: ticket.title, status: ticket.status, urgency: ticket.priority, dateOpened: ticket.dateOpened,
        createdAt: ticket.dateOpened, requester: null, source: 'glpi',
      });
      result.sort((a, b) => new Date(b.dateOpened || b.createdAt).getTime() - new Date(a.dateOpened || a.createdAt).getTime());
    }
    return result;
  }

  async ticketDetails(actor: any, glpiTicketId: number) {
    let entityId: number | null = null;
    let localTicket: PortalTicket | null = null;
    if (actor.role === 'user') {
      localTicket = await this.tickets.findOne({ where: { customerId: actor.customerId, portalUserId: actor.sub, glpiTicketId }, relations: ['requester'] });
      if (!localTicket) throw new ForbiddenException('Você não possui acesso a este chamado');
      entityId = localTicket.glpiEntityId;
    } else {
      const synced = await this.glpiTickets.findOne({ where: { customerId: actor.customerId, glpiTicketId } });
      localTicket = await this.tickets.findOne({ where: { customerId: actor.customerId, glpiTicketId }, relations: ['requester'] });
      entityId = synced?.glpiEntityId || localTicket?.glpiEntityId || null;
      if (!entityId) throw new NotFoundException('Chamado não encontrado para esta empresa');
    }
    const [details, customer] = await Promise.all([this.glpi.getPortalTicketDetails(glpiTicketId, entityId), this.customers.findOne({ where: { id: actor.customerId } })]);
    return {
      ...details,
      company: customer ? { id: customer.id, name: customer.name, document: customer.cpfCnpj } : null,
      requester: localTicket?.requester ? { name: localTicket.requester.name, email: localTicket.requester.email, phone: localTicket.requester.phone, department: localTicket.requester.department } : details.requester,
    };
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
    const receivables = await this.dataSource.query(`WITH documents AS (SELECT ar.id "accountId",ar.description,ar.total_value,ar.pending_value,ar.status,ar.due_date,p.id "paymentId",p.type,p.codigo_solicitacao code,p.status "paymentStatus",p.value "paymentValue",p.due_date "paymentDueDate",ROW_NUMBER() OVER (PARTITION BY ar.id ORDER BY p.due_date,p.created_at,p.id) "installmentNumber",COUNT(p.id) OVER (PARTITION BY ar.id) "installmentCount" FROM accounts_receivable ar LEFT JOIN payments p ON p.sale_id=ar.sale_id AND COALESCE(LOWER(p.status),'') NOT IN ('rejeitado','rejeitada','cancelado','cancelada','erro','falha') WHERE ar.customer_id=$1 AND COALESCE(LOWER(ar.status),'') NOT IN ('cancelado','cancelada','rejeitado','rejeitada','erro')) SELECT CASE WHEN "paymentId" IS NULL THEN "accountId" ELSE "paymentId" END id,CASE WHEN "installmentCount">1 THEN description||' - Parcela '||"installmentNumber"||'/'||"installmentCount" ELSE description END description,COALESCE("paymentValue",total_value) "totalValue",CASE WHEN "paymentId" IS NULL THEN pending_value ELSE COALESCE("paymentValue",0) END "pendingValue",status,COALESCE("paymentDueDate",due_date) "dueDate","paymentId",type,code,"paymentStatus" FROM documents ORDER BY COALESCE("paymentDueDate",due_date) DESC LIMIT 100`, [actor.customerId]);
    const invoices = await this.dataSource.query(`SELECT i.id,i.type,i.number,i.status,i.issued_at "issuedAt",s.total_amount "totalValue" FROM invoices i JOIN sales s ON s.id=i.sale_id WHERE s.customer_id=$1 AND COALESCE(LOWER(i.status),'') NOT IN ('rejeitada','rejeitado','cancelada','cancelado','erro','falha') ORDER BY i.created_at DESC LIMIT 100`, [actor.customerId]);
    const contracts = await this.contracts.find({ where: { customerId: actor.customerId }, order: { createdAt: 'DESC' } });
    return { receivables, invoices, contracts };
  }
  private requireFinancial(actor: any) {
    if (!['admin','finance'].includes(actor.role)) throw new ForbiddenException();
  }

  async boletoPdf(actor: any, paymentId: string) {
    this.requireFinancial(actor);
    const rows = await this.dataSource.query(`SELECT p.codigo_solicitacao code,p.type FROM payments p JOIN sales s ON s.id=p.sale_id WHERE p.id=$1 AND s.customer_id=$2 LIMIT 1`, [paymentId, actor.customerId]);
    const payment = rows[0];
    if (!payment) throw new NotFoundException('Boleto não encontrado para esta empresa');
    if (payment.type !== 'boleto' || !payment.code) throw new BadRequestException('Esta cobrança não possui PDF de boleto');
    return this.inter.getBoletoPdf(payment.code);
  }

  async invoiceDocument(actor: any, invoiceId: string) {
    this.requireFinancial(actor);
    const rows = await this.dataSource.query(`SELECT i.*,s.total_amount sale_total,c.name customer_name,c.cpf_cnpj customer_document FROM invoices i JOIN sales s ON s.id=i.sale_id JOIN customers c ON c.id=s.customer_id WHERE i.id=$1 AND s.customer_id=$2 LIMIT 1`, [invoiceId, actor.customerId]);
    if (!rows[0]) throw new NotFoundException('Nota fiscal não encontrada para esta empresa');
    return rows[0];
  }

  async invoiceXml(actor: any, invoiceId: string) {
    const invoice = await this.invoiceDocument(actor, invoiceId);
    const xml = invoice.xml_authorized || invoice.xml_sent;
    if (!xml) throw new NotFoundException('XML ainda não disponível');
    return { content: String(xml), filename: `${String(invoice.type || 'nota').toUpperCase()}_${invoice.number || 'nota'}.xml` };
  }

  async invoicePdf(actor: any, invoiceId: string) {
    const invoice = await this.invoiceDocument(actor, invoiceId);
    if (String(invoice.type).toLowerCase() !== 'nfse') throw new BadRequestException('A NF-e é disponibilizada para visualização e download do XML');
    if (!invoice.access_key || !invoice.certificate_id) throw new BadRequestException('NFS-e sem chave ou certificado vinculado');
    return { content: await this.nfse.downloadPdf(invoice.access_key, invoice.certificate_id), filename: `NFSe_${invoice.number || 'nota'}.pdf` };
  }
}
