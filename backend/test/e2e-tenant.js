// Teste de ponta a ponta do isolamento por tenant contra um PostgreSQL REAL e DESCARTÁVEL.
// Uso: E2E_DB_URL=postgres://postgres@127.0.0.1:54329/e2e node test/e2e-tenant.js   (rode "nest build" antes)
// Cria o schema a partir das entidades (synchronize), roda as migrações de unicidade de verdade e
// confere leitura, escrita, update/delete por id, override do tenant e o SQL cru. NUNCA aponte para
// um banco com dados: ele recria o schema.
const assert = require('node:assert/strict');
const path = require('node:path');
require('reflect-metadata');
const { DataSource } = require('typeorm');
const dist = path.resolve(__dirname, '..', 'dist');
const { installTenantScope, TenantStampSubscriber, stampTenantRow, tenantSql } = require(path.join(dist, 'common/tenant/tenant-scope'));
const { TenantContextService } = require(path.join(dist, 'common/tenant/tenant-context.service'));
const { SnakeNamingStrategy } = require(path.join(dist, 'config/snake-naming.strategy'));
const { TenantScopedUniques1794300000000 } = require(path.join(dist, 'database/migrations/1794300000000-TenantScopedUniques'));
const { TenantsService } = require(path.join(dist, 'modules/platform/tenants.service'));
const { PortalTicketTenantUnique1794400000000 } = require(path.join(dist, 'database/migrations/1794400000000-PortalTicketTenantUnique'));

const url = process.env.E2E_DB_URL;
if (!url || !/127\.0\.0\.1|localhost/.test(url)) { console.error('Defina E2E_DB_URL apontando para um Postgres LOCAL descartável.'); process.exit(2); }
const ctx = new TenantContextService();
let passed = 0;
const check = async (name, fn) => { try { await fn(); passed++; console.log('  ok  ', name); } catch (e) { console.error('  FALHOU', name, '\n        ', e.message); process.exitCode = 1; } };

(async () => {
  const ds = new DataSource({ type: 'postgres', url, entities: [path.join(dist, '**/*.entity.js')], subscribers: [TenantStampSubscriber], namingStrategy: new SnakeNamingStrategy(), synchronize: false, dropSchema: true });
  await ds.initialize(); await ds.synchronize();
  installTenantScope();
  const q = ds.createQueryRunner();
  await new TenantScopedUniques1794300000000().up(q);
  await new PortalTicketTenantUnique1794400000000().up(q);
  // Migração duas vezes tem que ser inofensiva (idempotente).
  await new TenantScopedUniques1794300000000().up(q);

  const tenants = ds.getRepository('Tenant');
  const A = (await tenants.save(tenants.create({ name: 'Empresa A', slug: 'a', status: 'ativo' }))).id;
  const B = (await tenants.save(tenants.create({ name: 'Empresa B', slug: 'b', status: 'ativo' }))).id;
  const products = ds.getRepository('Product');
  const mk = (code, extra = {}) => products.save(products.create({ code, name: 'Produto ' + code, purchasePrice: 5, salePrice: 10, quantity: 1, ...extra }));

  console.log('Isolamento de leitura e escrita');
  let pa, pb;
  await check('insert dentro do tenant A é carimbado com A', async () => { pa = await ctx.run(A, () => mk('P1')); assert.equal(pa.tenantId, A); });
  await check('o MESMO código em outro tenant é permitido (unicidade por tenant)', async () => { pb = await ctx.run(B, () => mk('P1')); assert.equal(pb.tenantId, B); });
  await check('o mesmo código no MESMO tenant é recusado', async () => { await assert.rejects(ctx.run(A, () => mk('P1')), /duplicate|unique|duplicad/i); });
  await check('tenant A só lista os produtos dele', async () => { const rows = await ctx.run(A, () => products.find()); assert.deepEqual(rows.map((r) => r.tenantId), [A]); });
  await check('tenant A não encontra por id o produto do tenant B', async () => { assert.equal(await ctx.run(A, () => products.findOne({ where: { id: pb.id } })), null); });
  await check('sem tenant no contexto (job/webhook) enxerga todos', async () => { assert.equal((await products.find()).length, 2); });

  console.log('Update e delete por id');
  await check('tenant A não consegue ALTERAR produto do B por id', async () => { const r = await ctx.run(A, () => products.update({ id: pb.id }, { name: 'invadido' })); assert.equal(r.affected, 0); assert.notEqual((await products.findOneBy({ id: pb.id })).name, 'invadido'); });
  await check('tenant A não consegue APAGAR produto do B por id', async () => { const r = await ctx.run(A, () => products.delete({ id: pb.id })); assert.equal(r.affected, 0); assert.ok(await products.findOneBy({ id: pb.id })); });
  await check('tenant A altera e apaga o PRÓPRIO produto normalmente', async () => { const u = await ctx.run(A, () => products.update({ id: pa.id }, { name: 'ok' })); assert.equal(u.affected, 1); const d = await ctx.run(A, () => products.delete({ id: pa.id })); assert.equal(d.affected, 1); });

  console.log('Mass assignment');
  await check('tenantId vindo no corpo é ignorado no insert', async () => { const p = await ctx.run(A, () => mk('MA', { tenantId: B })); assert.equal(p.tenantId, A); });
  await check('tenantId vindo no corpo não move o registro no update (save)', async () => { const own = await ctx.run(A, () => products.findOne({ where: { code: 'MA' } })); own.tenantId = B; own.name = 'mudou'; await ctx.run(A, () => products.save(own)); assert.equal((await products.findOneBy({ code: 'MA' })).tenantId, A); });

  console.log('SQL cru');
  await check('stampTenantRow carimba o tenant em INSERT cru', async () => {
    const supplier = await ctx.run(A, () => ds.getRepository('Supplier').save(ds.getRepository('Supplier').create({ name: 'F', cpfCnpj: '1' })));
    const r = await ctx.run(A, () => ds.query(`INSERT INTO bills (supplier_id, description, value, due_date, status) VALUES ($1,'raw',10,'2026-01-01','pendente') RETURNING id`, [supplier.id]));
    await ctx.run(A, () => stampTenantRow(ds.manager, 'bills', r[0].id));
    assert.equal((await ds.query(`SELECT tenant_id FROM bills WHERE id=$1`, [r[0].id]))[0].tenant_id, A);
  });
  await check('tenantSql filtra consulta crua de relatório por tenant', async () => {
    await ctx.run(B, async () => { await ds.query(`INSERT INTO bills (description, value, due_date, status, tenant_id) VALUES ('b-only',99,'2026-01-01','pago',$1)`, [B]); });
    const rowsA = await ctx.run(A, () => ds.query(`SELECT description FROM bills WHERE 1=1${tenantSql()}`));
    assert.ok(!rowsA.some((r) => r.description === 'b-only'));
    assert.ok((await ds.query(`SELECT description FROM bills`)).some((r) => r.description === 'b-only'));
  });

  console.log('Cadastros-base de tenant novo');
  const svc = new TenantsService(tenants, null, null, null, null);
  await check('seedDefaults cria plano de contas e centros de custo no tenant', async () => {
    const r = await svc.seedDefaults(A);
    assert.equal(r.chartAccounts, 15); assert.equal(r.costCenters, 4);
    assert.equal(Number((await ds.query(`SELECT COUNT(*) c FROM chart_accounts WHERE tenant_id=$1`, [A]))[0].c), 15);
  });
  await check('seedDefaults é idempotente (segunda chamada não duplica)', async () => {
    const r = await svc.seedDefaults(A); assert.equal(r.chartAccounts, 0); assert.equal(r.costCenters, 0);
  });
  await check('seedDefaults de B é independente e não toca nos dados de A', async () => {
    const r = await svc.seedDefaults(B); assert.equal(r.chartAccounts, 15);
    assert.equal(Number((await ds.query(`SELECT COUNT(*) c FROM chart_accounts`))[0].c), 30);
    assert.equal(Number((await ds.query(`SELECT COUNT(*) c FROM chart_accounts WHERE parent_id IS NOT NULL AND tenant_id=$1`, [B]))[0].c), 13);
  });
  await check('cada tenant enxerga só o próprio plano de contas', async () => {
    const rows = await ctx.run(A, () => ds.getRepository('ChartAccount').find());
    assert.equal(rows.length, 15); assert.ok(rows.every((r) => r.tenantId === A));
  });

  console.log('Entidades fora do escopo');
  await check('tabelas globais (tenants) continuam visíveis dentro de um tenant', async () => { assert.equal((await ctx.run(A, () => tenants.find())).length, 2); });

  console.log(`\n${passed} verificações passaram${process.exitCode ? ', COM FALHAS' : ''}.`);
  await ds.destroy();
})().catch((e) => { console.error('ERRO NO TESTE', e); process.exit(1); });
