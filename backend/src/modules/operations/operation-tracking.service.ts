import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type OperationStatus = 'processando' | 'concluida' | 'parcial' | 'falha';

@Injectable()
export class OperationTrackingService {
  constructor(private readonly db: DataSource) {}

  private sanitize(value: any, depth = 0): any {
    if (depth > 5) return '[resumo omitido]';
    if (Array.isArray(value)) return value.slice(0, 50).map(item => this.sanitize(item, depth + 1));
    if (!value || typeof value !== 'object') return typeof value === 'string' && value.length > 2000 ? value.slice(0, 2000) + '…' : value;
    return Object.fromEntries(Object.entries(value).slice(0, 100).map(([key, item]) => [key,
      /password|senha|token|secret|certificate|certificado|authorization|cookie|pfx|private.?key|client.?secret/i.test(key) ? '***' : this.sanitize(item, depth + 1),
    ]));
  }

  private title(method: string, path: string) {
    const route = path.toLowerCase();
    const rules: Array<[RegExp, string]> = [
      [/sales\/[^/]+\/cancel/, 'Cancelamento de venda'], [/sales\/[^/]+\/approve/, 'Aprovação de venda'], [/sales/, method === 'POST' ? 'Criação de venda' : 'Atualização de venda'],
      [/fiscal\/nfe\/emit/, 'Emissão de NF-e'], [/fiscal\/nfse\/emit/, 'Emissão de NFS-e'], [/fiscal\/.+\/cancel/, 'Cancelamento de nota fiscal'],
      [/inter\/generate/, 'Emissão de cobrança Banco Inter'], [/inter\/cancel/, 'Cancelamento de cobrança Banco Inter'], [/inter\/reconcile/, 'Conciliação Banco Inter'], [/inter\/webhook/, 'Processamento de webhook Banco Inter'],
      [/stock/, 'Movimentação de estoque'], [/financial|contas|bills/, 'Operação financeira'], [/mail|email/, 'Envio ou configuração de e-mail'],
      [/glpi|sla/, 'Sincronização GLPI/SLA'], [/contracts/, 'Operação de contrato'], [/purchases|suppliers/, 'Operação de compras'],
      [/reconciliation|ofx/, 'Conciliação bancária'], [/quotes|orcamentos/, 'Operação de orçamento'],
    ];
    return rules.find(([pattern]) => pattern.test(route))?.[1] || `${method} ${path.split('/').filter(Boolean).slice(0, 3).join(' / ')}`;
  }

  private classify(response: any): OperationStatus {
    const status = String(response?.status || response?.data?.status || '').toLowerCase();
    const failed = Number(response?.failed ?? response?.data?.failed ?? 0);
    const succeeded = Number(response?.updated ?? response?.processed ?? response?.checked ?? response?.quantidade ?? response?.data?.quantidade ?? 0);
    const errors = response?.errors || response?.data?.errors || response?.falhas || response?.data?.falhas;
    if (response?.success === false || ['rejeitada','rejeitado','erro','falha','failed'].includes(status)) return 'falha';
    if (failed > 0 || (Array.isArray(errors) && errors.length > 0)) return succeeded > 0 ? 'parcial' : 'falha';
    if (['parcial','partial'].includes(status)) return 'parcial';
    return 'concluida';
  }

  async startSafe(input: any): Promise<string | null> {
    try {
      const path = String(input.path || '').split('?')[0];
      const module = path.split('/').filter(Boolean).filter((part: string) => part !== 'api')[0] || 'sistema';
      const row = await this.db.query(`INSERT INTO operation_runs(module,action,title,status,http_method,path,entity_type,entity_id,user_id,request_summary,ip_address,user_agent,started_at) VALUES($1,$2,$3,'processando',$4,$5,$6,$7,$8,$9,$10,$11,NOW()) RETURNING id`, [module, input.action || `${input.method} ${path}`, this.title(input.method, path), input.method, path, input.entityType || module, input.entityId || null, input.userId || null, JSON.stringify(this.sanitize(input.body || {})), input.ip || null, input.userAgent || null]);
      return row[0]?.id || null;
    } catch { return null; }
  }

  async completeSafe(id: string | null, response: any, durationMs: number) {
    if (!id) return;
    try {
      const status = this.classify(response);
      await this.db.query(`UPDATE operation_runs SET status=$2,response_summary=$3,duration_ms=$4,finished_at=NOW(),message=$5 WHERE id=$1`, [id, status, JSON.stringify(this.sanitize(response)), durationMs, status === 'concluida' ? 'Operação confirmada pelo serviço responsável' : status === 'parcial' ? 'Operação concluída parcialmente; existem etapas pendentes ou com erro' : 'O serviço responsável não confirmou a operação']);
    } catch {}
  }

  async failSafe(id: string | null, error: any, durationMs: number) {
    if (!id) return;
    try {
      const message = error?.response?.data?.message || error?.message || String(error || 'Falha desconhecida');
      await this.db.query(`UPDATE operation_runs SET status='falha',error_message=$2,duration_ms=$3,finished_at=NOW(),message='Operação interrompida sem confirmação' WHERE id=$1`, [id, String(message).slice(0, 4000), durationMs]);
    } catch {}
  }

  async list(filters: any) {
    await this.db.query(`UPDATE operation_runs SET status='falha',message='Operação interrompida antes da confirmação',error_message=COALESCE(error_message,'Tempo máximo de processamento excedido ou serviço reiniciado'),finished_at=NOW() WHERE status='processando' AND started_at < NOW() - INTERVAL '15 minutes'`);
    const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
    const values: any[] = []; const where: string[] = [];
    if (filters.status) { values.push(filters.status); where.push(`o.status=$${values.length}`); }
    if (filters.module) { values.push(filters.module); where.push(`o.module=$${values.length}`); }
    if (filters.search) { values.push(`%${String(filters.search).trim()}%`); where.push(`(o.title ILIKE $${values.length} OR o.entity_id ILIKE $${values.length} OR o.message ILIKE $${values.length})`); }
    values.push(limit);
    return this.db.query(`SELECT o.id,o.module,o.action,o.title,o.status,o.entity_type "entityType",o.entity_id "entityId",o.message,o.error_message "errorMessage",o.duration_ms "durationMs",o.started_at "startedAt",o.finished_at "finishedAt",u.name "userName" FROM operation_runs o LEFT JOIN users u ON u.id=o.user_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.started_at DESC LIMIT $${values.length}`, values);
  }

  async detail(id: string) {
    return (await this.db.query(`SELECT o.*,u.name "userName",u.email "userEmail" FROM operation_runs o LEFT JOIN users u ON u.id=o.user_id WHERE o.id=$1`, [id]))[0] || null;
  }
}