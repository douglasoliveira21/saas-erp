import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OperationsService {
  constructor(private db: DataSource, private audit: AuditService) {}

  async search(q: string) {
    if (!q?.trim() || q.trim().length < 2) return [];
    const term = `%${q.trim()}%`;
    return this.db.query(`
      SELECT 'cliente' type, id, name title, COALESCE(cpf_cnpj,'') subtitle FROM customers WHERE name ILIKE $1 OR cpf_cnpj ILIKE $1
      UNION ALL SELECT 'venda', s.id, 'Venda #' || LEFT(s.id::text,8), COALESCE(c.name,'') FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.id::text ILIKE $1 OR c.name ILIKE $1
      UNION ALL SELECT 'nota', i.id, UPPER(i.type) || ' ' || COALESCE(i.number::text,'sem numero'), COALESCE(i.access_key,i.recipient_name,'') FROM invoices i WHERE i.access_key ILIKE $1 OR i.recipient_name ILIKE $1 OR i.number::text ILIKE $1
      UNION ALL SELECT 'boleto', p.id, 'Boleto ' || COALESCE(p.status,''), COALESCE(p.codigo_solicitacao,'') FROM payments p WHERE p.codigo_solicitacao ILIKE $1 OR p.sale_id::text ILIKE $1
      LIMIT 50`, [term]);
  }

  dataQuality() {
    return this.db.query(`SELECT 'cliente' type, id, name, ARRAY_REMOVE(ARRAY[
      CASE WHEN cpf_cnpj IS NULL OR cpf_cnpj='' THEN 'CPF/CNPJ' END, CASE WHEN email IS NULL OR email='' THEN 'email' END,
      CASE WHEN address IS NULL OR address='' THEN 'endereco' END, CASE WHEN city IS NULL OR city='' THEN 'cidade' END,
      CASE WHEN uf IS NULL OR uf='' THEN 'UF' END, CASE WHEN cep IS NULL OR cep='' THEN 'CEP' END],NULL) missing
      FROM customers WHERE active=true AND (COALESCE(cpf_cnpj,'')='' OR COALESCE(email,'')='' OR COALESCE(address,'')='' OR COALESCE(city,'')='' OR COALESCE(uf,'')='' OR COALESCE(cep,'')='')
      UNION ALL SELECT 'produto', id, name, ARRAY_REMOVE(ARRAY[CASE WHEN COALESCE(ncm,'')='' THEN 'NCM' END,
      CASE WHEN COALESCE(cfop,'')='' THEN 'CFOP' END, CASE WHEN COALESCE(unit,'')='' THEN 'unidade' END],NULL)
      FROM products WHERE active=true AND (COALESCE(ncm,'')='' OR COALESCE(cfop,'')='' OR COALESCE(unit,'')='') ORDER BY type,name`);
  }

  list(table: string, order = 'created_at DESC') { return this.db.query(`SELECT * FROM ${table} ORDER BY ${order}`); }
  async create(table: string, body: any, userId: string, action: string) {
    const keys = Object.keys(body).filter(k => /^[a-z_]+$/.test(k));
    if (!keys.length) throw new BadRequestException('Dados obrigatorios');
    const values = keys.map(k => body[k]);
    const row = (await this.db.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`, values))[0];
    await this.audit.safeCreate({ userId, action, entity: table, entityId: row.id, newData: row });
    return row;
  }

  async approve(id: string, userId: string, rejectReason?: string) {
    const item = (await this.db.query('SELECT * FROM approval_requests WHERE id=$1', [id]))[0];
    if (!item) throw new NotFoundException('Solicitacao nao encontrada');
    if (rejectReason) return (await this.db.query(`UPDATE approval_requests SET status='rejeitada', reason=reason || E'\nRejeicao: ' || $2, updated_at=now() WHERE id=$1 RETURNING *`, [id,rejectReason]))[0];
    if (item.requested_by === userId || item.first_approved_by === userId) throw new BadRequestException('Solicitante e aprovadores devem ser pessoas diferentes');
    const sql = item.first_approved_by
      ? `UPDATE approval_requests SET second_approved_by=$2,second_approved_at=now(),status='aprovada',updated_at=now() WHERE id=$1 RETURNING *`
      : `UPDATE approval_requests SET first_approved_by=$2,first_approved_at=now(),status='aguardando_segunda',updated_at=now() WHERE id=$1 RETURNING *`;
    const row = (await this.db.query(sql,[id,userId]))[0];
    await this.audit.safeCreate({ userId, action: 'approval.reviewed', entity: 'approval_request', entityId: id, newData: row });
    return row;
  }

  async updateCase(id: string, body: any, userId: string) {
    const allowed = ['stage','status','negotiated_amount','installments','next_action_at','notes'];
    const keys = allowed.filter(k => body[k] !== undefined);
    const row = (await this.db.query(`UPDATE collection_cases SET ${keys.map((k,i)=>`${k}=$${i+2}`).join(',')},updated_at=now() WHERE id=$1 RETURNING *`,[id,...keys.map(k=>body[k])]))[0];
    await this.audit.safeCreate({ userId, action: 'collection.updated', entity: 'collection_case', entityId: id, newData: row });
    return row;
  }

  async updateNotification(id: string, action: string, userId: string, assignedTo?: string) {
    const setters: Record<string,string> = { read: `status='lida',read_at=now()`, resolve: `status='resolvida',resolved_at=now()`, assign: `assigned_to=$3` };
    if (!setters[action]) throw new BadRequestException('Acao invalida');
    return (await this.db.query(`UPDATE notifications SET ${setters[action]} WHERE id=$1 AND (user_id IS NULL OR user_id=$2) RETURNING *`,[id,userId,assignedTo]))[0];
  }

  async notifications(userId: string, role: string) {
    if (role === 'admin' || role === 'financeiro') await this.refreshSystemNotifications();
    const globalFilter = role === 'admin' || role === 'financeiro' ? 'OR user_id IS NULL' : '';
    return this.db.query(`SELECT * FROM notifications
      WHERE user_id=$1 OR assigned_to=$1 ${globalFilter}
      ORDER BY CASE status WHEN 'nova' THEN 0 WHEN 'lida' THEN 1 ELSE 2 END, created_at DESC LIMIT 50`, [userId]);
  }

  async markAllNotificationsRead(userId: string, role: string) {
    const globalFilter = role === 'admin' || role === 'financeiro' ? 'OR user_id IS NULL' : '';
    await this.db.query(`UPDATE notifications SET status='lida',read_at=now()
      WHERE status='nova' AND (user_id=$1 OR assigned_to=$1 ${globalFilter})`, [userId]);
    return { success: true };
  }

  private async refreshSystemNotifications() {
    await this.db.query(`INSERT INTO notifications(title,message,type,entity_type,entity_id)
      SELECT 'Conta vencida', COALESCE(c.name,'Cliente') || ': R$ ' || ar.pending_value::text, 'financeiro', 'account_receivable', ar.id
      FROM accounts_receivable ar LEFT JOIN customers c ON c.id=ar.customer_id
      WHERE ar.due_date < CURRENT_DATE AND ar.status IN ('pendente','parcial','vencido')
      AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.entity_type='account_receivable' AND n.entity_id=ar.id AND n.status<>'resolvida')`);
    await this.db.query(`INSERT INTO notifications(title,message,type,entity_type,entity_id)
      SELECT 'Rejeicao fiscal', UPPER(i.type) || COALESCE(' ' || i.number::text,'') || ': ' || COALESCE(i.rejection_reason,'Verifique a tentativa de emissao'), 'fiscal', 'invoice', i.id
      FROM invoices i WHERE i.status IN ('rejeitada','erro')
      AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.entity_type='invoice' AND n.entity_id=i.id AND n.status<>'resolvida')`);
    await this.db.query(`INSERT INTO notifications(title,message,type,entity_type,entity_id)
      SELECT 'Aprovacao pendente', type || ': ' || reason, 'aprovacao', 'approval_request', a.id
      FROM approval_requests a WHERE a.status IN ('pendente','aguardando_segunda')
      AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.entity_type='approval_request' AND n.entity_id=a.id AND n.status<>'resolvida')`);
    await this.db.query(`INSERT INTO notifications(title,message,type,entity_type,entity_id)
      SELECT 'Estoque baixo', p.name || ': ' || p.quantity::text || ' disponivel(is)', 'estoque', 'product', p.id
      FROM products p WHERE p.active=true AND (p.quantity-p.reserved_quantity)<=p.min_stock
      AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.entity_type='product' AND n.entity_id=p.id AND n.status<>'resolvida')`);
  }

  async preference(userId: string, widgets?: any[]) {
    if (!widgets) return (await this.db.query('SELECT * FROM dashboard_preferences WHERE user_id=$1',[userId]))[0] || { user_id:userId, widgets:[] };
    return (await this.db.query(`INSERT INTO dashboard_preferences(user_id,widgets) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET widgets=$2,updated_at=now() RETURNING *`,[userId,JSON.stringify(widgets)]))[0];
  }

  accountingExport(start: string, end: string) {
    return this.db.query(`SELECT m.date,m.competence_date,m.type,m.category,m.description,m.value,cc.code cost_center,ca.code chart_account,ba.name bank_account
      FROM financial_movements m LEFT JOIN cost_centers cc ON cc.id=m.cost_center_id LEFT JOIN chart_accounts ca ON ca.id=m.chart_account_id
      LEFT JOIN bank_accounts ba ON ba.id=m.bank_account_id WHERE m.date BETWEEN $1 AND $2 ORDER BY m.date,m.created_at`,[start,end]);
  }
}
