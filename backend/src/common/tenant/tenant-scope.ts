import { DeleteQueryBuilder, EntitySubscriberInterface, EventSubscriber, InsertEvent, SelectQueryBuilder, UpdateEvent, UpdateQueryBuilder } from 'typeorm';
import { SoftDeleteQueryBuilder } from 'typeorm/query-builder/SoftDeleteQueryBuilder';
import { currentTenantId } from './tenant-context.service';

// Escopo automático por tenant, aplicado a TODA entidade que mapeia a propriedade `tenantId`
// (menos as de TENANT_UNSCOPED_TABLES):
//  - leitura: toda consulta TypeORM (find*, QueryBuilder, count) ganha `AND tenant_id = <tenant
//    da requisição>` na tabela principal;
//  - escrita: todo INSERT recebe o tenant da requisição quando a entidade não o define - sem
//    isso a coluna cai no DEFAULT do banco (tenant legado) e o dado de um tenant novo acabaria
//    gravado na conta do tenant antigo.
// Sem tenant no contexto (login, webhooks, jobs agendados, super admin) nada muda: continua
// sem filtro, igual a antes. SQL cru (manager.query) NÃO passa por aqui e precisa filtrar à mão.
// Desligar em emergência: TENANT_SCOPING=off.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Tabelas que têm a coluna mas NÃO devem ser filtradas: são escritas/lidas por fluxos sem
// contexto de tenant (autenticação, webhooks, portal, GLPI, jobs globais) ou são catálogos
// compartilhados. Entram aqui até esses fluxos serem tornados cientes de tenant.
const TENANT_UNSCOPED_TABLES = new Set([
  'auth_sessions', 'password_resets', 'inter_webhook_events',
  'glpi_config', 'glpi_tickets', 'sla_monthly_snapshots',
  'whatsapp_message_logs', 'service_order_statuses',
  'email_delivery_logs',
]);

const enabled = () => String(process.env.TENANT_SCOPING || 'on').toLowerCase() !== 'off';

function scopedTenantId(metadata: any): string | null {
  if (!enabled() || !metadata) return null;
  if (TENANT_UNSCOPED_TABLES.has(metadata.tableName)) return null;
  if (!metadata.findColumnWithPropertyName?.('tenantId')) return null;
  const tenantId = currentTenantId();
  return tenantId && UUID_RE.test(tenantId) ? tenantId : null;
}

let installed = false;

// Acrescenta a condição de tenant ao WHERE do builder (select/update/delete/soft-delete). Para
// update/delete isso impede alterar ou apagar, por id adivinhado, registro de outro tenant.
function applyTenantCondition(qb: any, queryTypes: string[]): void {
  const map: any = qb.expressionMap;
  if (!queryTypes.includes(map.queryType) || !map.mainAlias?.hasMetadata) return;
  const tenantId = scopedTenantId(map.mainAlias.metadata);
  if (!tenantId) return;
  // select usa alias.propriedade (o TypeORM traduz); update/delete/soft-delete não têm alias na
  // consulta, então precisam da coluna real - `Entidade.tenantId` viraria SQL inválido ali.
  const column = map.mainAlias.metadata.findColumnWithPropertyName('tenantId').databaseName;
  const condition = map.queryType === 'select' ? `${map.mainAlias.name}.tenantId = '${tenantId}'` : `"${column}" = '${tenantId}'`;
  const current: string | undefined = map.extraAppendedAndWhereCondition;
  if (!current) map.extraAppendedAndWhereCondition = condition;
  else if (!current.includes(condition)) map.extraAppendedAndWhereCondition = `(${current}) AND ${condition}`;
}

export function installTenantScope(): void {
  if (installed) return;
  installed = true;
  const patch = (proto: any, queryTypes: string[]) => {
    const original = proto.getQuery;
    proto.getQuery = function (this: any) {
      applyTenantCondition(this, queryTypes);
      return original.call(this);
    };
  };
  patch(SelectQueryBuilder.prototype, ['select']);
  patch(UpdateQueryBuilder.prototype, ['update']);
  patch(DeleteQueryBuilder.prototype, ['delete']);
  patch(SoftDeleteQueryBuilder.prototype, ['soft-delete', 'restore']);
}

// Fragmento ` AND [alias.]tenant_id = '<tenant>'` para SQL cru (relatórios/DRE) - vazio quando não
// há tenant no contexto ou o escopo está desligado. O tenant vem do JWT e é validado como UUID
// antes de entrar na string, então não há risco de injeção.
export function tenantSql(alias?: string): string {
  const tenantId = currentTenantId();
  if (!enabled() || !tenantId || !UUID_RE.test(tenantId)) return '';
  return ` AND ${alias ? alias + '.' : ''}tenant_id = '${tenantId}'`;
}

// INSERT em SQL cru não passa pelo subscriber abaixo: sem tenant_id a linha cai no DEFAULT do
// banco (tenant legado). Chame depois do INSERT (com RETURNING id) pra carimbar o tenant atual.
const STAMPABLE_TABLES = new Set(['financial_movements', 'bills', 'invoices', 'payments']);
export async function stampTenantRow(manager: { query: (sql: string, params?: any[]) => Promise<any> }, table: string, id?: string | null): Promise<void> {
  const tenantId = currentTenantId();
  if (!id || !enabled() || !tenantId || !UUID_RE.test(tenantId) || !STAMPABLE_TABLES.has(table)) return;
  await manager.query(`UPDATE ${table} SET tenant_id = $1 WHERE id = $2`, [tenantId, id]);
}

@EventSubscriber()
export class TenantStampSubscriber implements EntitySubscriberInterface {
  // Dentro de uma requisição de tenant o tenantId é SEMPRE o do contexto - nunca o que veio no
  // corpo da requisição. Vários endpoints fazem repo.create(body)/Object.assign(entidade, body)
  // com body livre; sem isso um usuário poderia enviar { tenantId: <outro tenant> } e gravar ou
  // mover dados para outro tenant.
  beforeInsert(event: InsertEvent<any>): void {
    const entity = event.entity;
    if (!entity || typeof entity !== 'object') return;
    const tenantId = scopedTenantId(event.metadata);
    if (tenantId) entity.tenantId = tenantId;
  }

  beforeUpdate(event: UpdateEvent<any>): void {
    const entity = event.entity as any;
    if (!entity || typeof entity !== 'object') return;
    const tenantId = scopedTenantId(event.metadata);
    if (tenantId && entity.tenantId !== undefined) entity.tenantId = tenantId;
  }
}
