// Teste de regressão do escopo por tenant. Roda contra o build (dist) e NÃO precisa de banco:
// só monta os metadados do TypeORM e confere o SQL gerado.   Uso: npm run test:scope
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
require('reflect-metadata');
const { DataSource } = require('typeorm');

const dist = path.resolve(__dirname, '..', 'dist');
const { installTenantScope, tenantSql, TenantStampSubscriber, insertWithTenant } = require(path.join(dist, 'common/tenant/tenant-scope'));
const { TenantContextService } = require(path.join(dist, 'common/tenant/tenant-context.service'));
const { SnakeNamingStrategy } = require(path.join(dist, 'config/snake-naming.strategy'));

const TENANT = '11111111-2222-3333-4444-555555555555';
const ctx = new TenantContextService();
let ds;

test.before(async () => {
  ds = new DataSource({ type: 'postgres', entities: [path.join(dist, '**/*.entity.js')], namingStrategy: new SnakeNamingStrategy() });
  await ds.buildMetadatas();
  installTenantScope();
});
test.beforeEach(() => { delete process.env.TENANT_SCOPING; });

const sql = (qb) => qb.getQuery();

test('sem tenant no contexto a consulta não muda', () => {
  assert.ok(!sql(ds.getRepository('Bill').createQueryBuilder('b')).includes('tenant_id" = '));
});

test('com tenant no contexto select, update e delete são filtrados', () => {
  ctx.run(TENANT, () => {
    const bills = ds.getRepository('Bill');
    assert.match(sql(bills.createQueryBuilder('b')), new RegExp(`"b"."tenant_id" = '${TENANT}'`));
    assert.match(sql(bills.createQueryBuilder().update().set({ status: 'pago' }).where('id = :id', { id: 'x' })), new RegExp(`"tenant_id" = '${TENANT}'`));
    assert.match(sql(bills.createQueryBuilder().delete().where('id = :id', { id: 'x' })), new RegExp(`"tenant_id" = '${TENANT}'`));
  });
});

test('o SQL de update/delete não usa alias de entidade (seria SQL inválido)', () => {
  ctx.run(TENANT, () => {
    const q = sql(ds.getRepository('Bill').createQueryBuilder().update().set({ status: 'pago' }).where('id = :id', { id: 'x' }));
    assert.ok(!/Bill\.tenantId/.test(q), q);
  });
});

test('entidades globais e de autenticação não são filtradas', () => {
  ctx.run(TENANT, () => {
    assert.ok(!sql(ds.getRepository('Tenant').createQueryBuilder('t')).includes('tenant_id ='));
    assert.ok(!sql(ds.getRepository('AuthSession').createQueryBuilder('s')).includes('tenant_id ='));
  });
});

test('TENANT_SCOPING=off desliga o filtro', () => {
  process.env.TENANT_SCOPING = 'off';
  ctx.run(TENANT, () => assert.ok(!sql(ds.getRepository('Bill').createQueryBuilder('b')).includes('tenant_id =')));
  assert.equal(ctx.run(TENANT, () => tenantSql('x')), '');
});

test('tenantSql gera fragmento só com UUID válido', () => {
  assert.equal(tenantSql('p'), '');
  assert.equal(ctx.run(TENANT, () => tenantSql('p')), ` AND p.tenant_id = '${TENANT}'`);
  assert.equal(ctx.run("x'; DROP TABLE users;--", () => tenantSql()), '');
});

test('o tenant do contexto sempre prevalece sobre o enviado no corpo (insert e update)', () => {
  const subscriber = new TenantStampSubscriber();
  const metadata = ds.getMetadata('Bill');
  ctx.run(TENANT, () => {
    const inserted = { tenantId: '99999999-9999-9999-9999-999999999999' };
    subscriber.beforeInsert({ entity: inserted, metadata });
    assert.equal(inserted.tenantId, TENANT);
    const updated = { tenantId: '99999999-9999-9999-9999-999999999999' };
    subscriber.beforeUpdate({ entity: updated, metadata });
    assert.equal(updated.tenantId, TENANT);
  });
});

test('insertWithTenant acrescenta a coluna e o parametro ao INSERT quando ha tenant', async () => {
  const calls = [];
  const manager = { query: async (sql, params) => { calls.push({ sql, params }); return []; } };
  await ctx.run(TENANT, () => insertWithTenant(manager, "INSERT INTO financial_movements (type, value, paid_at) VALUES ('receita', $1, now()) RETURNING id", [10]));
  assert.equal(calls[0].sql, "INSERT INTO financial_movements (type, value, paid_at, tenant_id) VALUES ('receita', $1, now(), $2) RETURNING id");
  assert.deepEqual(calls[0].params, [10, TENANT]);
});

test('insertWithTenant nao altera o INSERT sem tenant ou com o escopo desligado', async () => {
  const calls = [];
  const manager = { query: async (sql, params) => { calls.push({ sql, params }); return []; } };
  const sql = 'INSERT INTO bills (description) VALUES ($1)';
  await insertWithTenant(manager, sql, ['x']);
  process.env.TENANT_SCOPING = 'off';
  await ctx.run(TENANT, () => insertWithTenant(manager, sql, ['x']));
  assert.ok(calls.every((c) => c.sql === sql && c.params.length === 1));
});
