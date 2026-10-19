// Teste de ponta a ponta HTTP: o backend de verdade sobe contra um Postgres DESCARTAVEL e este
// script faz login com dois tenants e confere o isolamento pela API.
//   E2E_DB_URL=postgres://postgres@127.0.0.1:54329/e2e_http  E2E_API=http://127.0.0.1:5099 node test/e2e-http.js
// O backend precisa estar rodando em NODE_ENV=development (cria o schema sozinho). NUNCA use banco real.
const assert = require('node:assert/strict');
const { Client } = require('pg');
const bcrypt = require('bcrypt');

const API = process.env.E2E_API || 'http://127.0.0.1:5099';
const dbUrl = process.env.E2E_DB_URL;
if (!dbUrl || !/127\.0\.0\.1|localhost/.test(dbUrl)) {
  console.error('Defina E2E_DB_URL apontando para um Postgres LOCAL descartavel.');
  process.exit(2);
}

let passed = 0;
const check = async (name, fn) => {
  try { await fn(); passed++; console.log('  ok  ', name); } catch (e) { console.error('  FALHOU', name, '\n        ', e.message); process.exitCode = 1; }
};
const call = async (method, path, token, body, headers = {}) => {
  const res = await fetch(API + '/api' + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* sem corpo */ }
  return { status: res.status, json, headers: res.headers };
};

(async () => {
  const db = new Client({ connectionString: dbUrl });
  await db.connect();
  const one = async (sql, p) => (await db.query(sql, p)).rows[0];
  // Limpa restos de execucoes anteriores (o script pode rodar varias vezes no mesmo banco).
  const old = (await db.query("SELECT id FROM tenants WHERE slug IN ('a-e2e','b-e2e')")).rows.map((r) => r.id);
  if (old.length) {
    // O banco proibe UPDATE/DELETE em lancamento realizado; neste banco descartavel, desliga os gatilhos.
    await db.query('SET session_replication_role = replica');
    await db.query('DELETE FROM contract_billings WHERE contract_id IN (SELECT id FROM contracts WHERE tenant_id = ANY($1))', [old]);
    for (const t of ['service_orders', 'routes', 'commissions', 'financial_movements', 'installment_payments', 'installments', 'accounts_receivable', 'payments', 'sale_items', 'sales', 'contracts', 'customers', 'suppliers', 'products', 'bills', 'fiscal_config', 'company_profiles', 'users', 'chart_accounts', 'cost_centers']) {
      await db.query(`DELETE FROM ${t} WHERE tenant_id = ANY($1)`, [old]);
    }
    await db.query('DELETE FROM tenants WHERE id = ANY($1)', [old]);
    await db.query('SET session_replication_role = DEFAULT');
  }
  await db.query("DELETE FROM plans WHERE name = 'e2e'");
  const modules = ['products', 'sales', 'pagamentos', 'financeiro', 'dre', 'reports', 'fiscal', 'contracts', 'compras', 'stock', 'services', 'orcamentos', 'contas_pagar', 'company', 'email_settings', 'financeiro'];
  const plan = await one('INSERT INTO plans (name, modules) VALUES ($1, $2::jsonb) RETURNING id', ['e2e', JSON.stringify(modules)]);
  const mkTenant = async (name, slug) => (await one("INSERT INTO tenants (name, slug, status, plan_id) VALUES ($1,$2,'ativo',$3) RETURNING id", [name, slug, plan.id])).id;
  const A = await mkTenant('Empresa A', 'a-e2e');
  const B = await mkTenant('Empresa B', 'b-e2e');
  const hash = await bcrypt.hash('Senha@12345', 10);
  for (const [t, email] of [[A, 'admin-a@e2e.test'], [B, 'admin-b@e2e.test']]) {
    await db.query("INSERT INTO users (tenant_id, name, email, password, role) VALUES ($1,'Admin',$2,$3,'admin')", [t, email, hash]);
  }
  const login = async (email) => {
    const r = await call('POST', '/auth/login', null, { email, password: 'Senha@12345' });
    assert.ok([200, 201].includes(r.status), 'login ' + email + ' -> ' + r.status + ' ' + JSON.stringify(r.json));
    return r.json.access_token;
  };
  const tokenA = await login('admin-a@e2e.test');
  const tokenB = await login('admin-b@e2e.test');

  const prod = async (t, code) => (await one('INSERT INTO products (tenant_id, name, code, purchase_price, sale_price) VALUES ($1,$2,$3,5,10) RETURNING id', [t, 'Produto ' + code, code])).id;
  const pA = await prod(A, 'PA');
  const pB = await prod(B, 'PB');
  const month = new Date().toISOString().slice(0, 7);
  const day = month + '-10';
  for (const [t, v] of [[A, 1000], [B, 7777]]) {
    await db.query("INSERT INTO financial_movements (tenant_id, type, category, description, value, date, is_forecast) VALUES ($1,'receita','venda','rec',$2,$3,false)", [t, v, day]);
  }
  await db.query("INSERT INTO financial_movements (tenant_id, type, category, description, value, date, is_forecast) VALUES ($1,'despesa','outros','desp',300,$2,false)", [A, day]);

  console.log('Login: Lembrar-me');
  const rawLogin = async (rememberMe) => {
    const res = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin-a@e2e.test', password: 'Senha@12345', ...(rememberMe === undefined ? {} : { rememberMe }) }) });
    const json = await res.json();
    const payload = JSON.parse(Buffer.from(json.access_token.split('.')[1], 'base64url').toString());
    return { status: res.status, cookie: res.headers.get('set-cookie') || '', ttlSeconds: payload.exp - payload.iat };
  };
  await check('sem "Lembrar-me": sessao de 12 h e cookie de sessao (sem Max-Age/Expires)', async () => {
    for (const r of [await rawLogin(false), await rawLogin(undefined)]) {
      assert.ok([200, 201].includes(r.status)); assert.equal(r.ttlSeconds, 12 * 3600);
      assert.ok(r.cookie.includes('access_token='), r.cookie); assert.ok(!/max-age|expires/i.test(r.cookie), 'cookie nao pode ser persistente: ' + r.cookie);
    }
  });
  await check('com "Lembrar-me": sessao de 30 dias e cookie persistente de 30 dias', async () => {
    const r = await rawLogin(true);
    assert.ok([200, 201].includes(r.status)); assert.equal(r.ttlSeconds, 30 * 86400);
    const maxAge = Number((r.cookie.match(/max-age=(\d+)/i) || [])[1]); assert.equal(maxAge, 30 * 86400, r.cookie);
  });
  await check('a sessao "lembrada" continua valida no servidor (expira em ~30 dias)', async () => {
    const row = await one("SELECT expires_at FROM auth_sessions WHERE expires_at > now() + interval '29 days' ORDER BY created_at DESC LIMIT 1");
    assert.ok(row, 'deveria existir uma sessao de 30 dias');
  });
  await check('rememberMe com tipo invalido e recusado (400)', async () => {
    const res = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin-a@e2e.test', password: 'Senha@12345', rememberMe: 'sim' }) });
    assert.equal(res.status, 400);
  });

  console.log('Produtos');
  await check('A lista so os proprios produtos', async () => {
    const r = await call('GET', '/products', tokenA);
    assert.equal(r.status, 200);
    const codes = (r.json.data || r.json).map((p) => p.code);
    assert.deepEqual(codes, ['PA']);
  });
  await check('A nao abre produto do B por id (404)', async () => {
    assert.equal((await call('GET', '/products/' + pB, tokenA)).status, 404);
  });
  await check('A nao consegue alterar produto do B e o nome nao muda', async () => {
    const r = await call('PATCH', '/products/' + pB, tokenA, { name: 'invadido' });
    assert.ok([403, 404].includes(r.status), 'status ' + r.status);
    assert.equal((await one('SELECT name FROM products WHERE id=$1', [pB])).name, 'Produto PB');
  });
  await check('A nao consegue apagar produto do B', async () => {
    await call('DELETE', '/products/' + pB, tokenA);
    assert.ok(await one('SELECT id FROM products WHERE id=$1 AND archived_at IS NULL', [pB]));
  });
  await check('A altera o proprio produto', async () => {
    const r = await call('PATCH', '/products/' + pA, tokenA, { name: 'meu' });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  });

  console.log('Pagamento de conta (fluxo que grava lancamento realizado)');
  const supplier = (await one("INSERT INTO suppliers (tenant_id, name, cpf_cnpj) VALUES ($1,'Forn A','123') RETURNING id", [A])).id;
  const bill = (await one("INSERT INTO bills (tenant_id, supplier_id, description, value, due_date, status) VALUES ($1,$2,'Conta A',250,$3,'pendente') RETURNING id", [A, supplier, day])).id;
  await check('B nao consegue pagar conta do A', async () => {
    const r = await call('PATCH', '/bills/' + bill + '/pay', tokenB, { paymentMethod: 'pix' });
    assert.ok([403, 404].includes(r.status), 'status ' + r.status);
    assert.equal((await one('SELECT status FROM bills WHERE id=$1', [bill])).status, 'pendente');
  });
  await check('A paga a propria conta e o lancamento realizado nasce no tenant A', async () => {
    const r = await call('PATCH', '/bills/' + bill + '/pay', tokenA, { paymentMethod: 'pix' });
    assert.ok([200, 201].includes(r.status), r.status + ' ' + JSON.stringify(r.json));
    const mov = await one("SELECT tenant_id, type, is_forecast FROM financial_movements WHERE bill_id=$1", [bill]);
    assert.equal(mov.tenant_id, A); assert.equal(mov.type, 'despesa'); assert.equal(mov.is_forecast, false);
  });

  console.log('Baixa com multa e juros (venda e contrato)');
  const cust = (await one("INSERT INTO customers (tenant_id, name) VALUES ($1,'Cliente A') RETURNING id", [A])).id;
  const tech = (await one("SELECT id FROM users WHERE tenant_id=$1 LIMIT 1", [A])).id;
  const sale = (await one("INSERT INTO sales (tenant_id, technician_id, customer_id, payment_method, subtotal, total_amount, installments) VALUES ($1,$2,$3,'boleto',600,600,1) RETURNING id", [A, tech, cust])).id;
  await db.query("INSERT INTO sale_items (tenant_id, sale_id, name, quantity, unit_price, total_price) VALUES ($1,$2,'Servico de rede',1,600,600)", [A, sale]);
  const salePay = (await one("INSERT INTO payments (tenant_id, sale_id, customer_id, type, codigo_solicitacao, status, value, customer_name, due_date) VALUES ($1,$2,$3,'boleto','COD-VENDA-1','a_receber',600,'Cliente A',$4) RETURNING id", [A, sale, cust, day])).id;
  await check('venda: baixa manual com R$ 630 quita a parcela em 600 e registra 30 de multa/juros no tenant A', async () => {
    const r = await call('POST', '/inter/payments/' + salePay + '/mark-received', tokenA, { note: 'teste', receivedValue: 630 });
    assert.ok([200, 201].includes(r.status), r.status + ' ' + JSON.stringify(r.json));
    const pay = await one('SELECT status, received_value FROM payments WHERE id=$1', [salePay]);
    assert.equal(pay.status, 'pago'); assert.equal(Number(pay.received_value), 630);
    const rows = (await db.query("SELECT category, value, tenant_id, is_forecast FROM financial_movements WHERE sale_id=$1 AND is_forecast=false ORDER BY value DESC", [sale])).rows;
    assert.deepEqual(rows.map((x) => [x.category, Number(x.value)]), [['venda', 600], ['multa_juros', 30]]);
    assert.ok(rows.every((x) => x.tenant_id === A), 'todos os lancamentos devem estar no tenant A');
    const acc = await one('SELECT paid_value, total_value, status FROM accounts_receivable WHERE sale_id=$1', [sale]);
    assert.equal(Number(acc.paid_value), 600); assert.equal(acc.status, 'pago');
  });
  await check('venda: repetir a baixa nao duplica a multa', async () => {
    await call('POST', '/inter/payments/' + salePay + '/mark-received', tokenA, { receivedValue: 630 });
    assert.equal(Number((await one("SELECT COUNT(*) c FROM financial_movements WHERE sale_id=$1 AND category='multa_juros'", [sale])).c), 1);
  });
  const contract = (await one("INSERT INTO contracts (tenant_id, customer_id, title, total_value, start_date) VALUES ($1,$2,'Manutencao Mensal',600,$3) RETURNING id", [A, cust, day])).id;
  await db.query("INSERT INTO contract_billings (contract_id, customer_id, billing_period, due_date, value, boleto_code) VALUES ($1,$2,$3,$4,600,'COD-CONTRATO-1')", [contract, cust, month, day]);
  const contractPay = (await one("INSERT INTO payments (tenant_id, sale_id, customer_id, type, codigo_solicitacao, status, value, customer_name, due_date) VALUES ($1,NULL,$2,'boleto','COD-CONTRATO-1','a_receber',600,'Cliente A',$3) RETURNING id", [A, cust, day])).id;
  await check('contrato: baixa com R$ 630 vira UM credito de 630 (categoria contrato) no tenant A', async () => {
    const r = await call('POST', '/inter/payments/' + contractPay + '/mark-received', tokenA, { receivedValue: 630 });
    assert.ok([200, 201].includes(r.status), r.status + ' ' + JSON.stringify(r.json));
    const rows = (await db.query("SELECT category, value, tenant_id, type FROM financial_movements WHERE idempotency_key='contract:COD-CONTRATO-1'")).rows;
    assert.equal(rows.length, 1); assert.equal(rows[0].category, 'contrato'); assert.equal(Number(rows[0].value), 630);
    assert.equal(rows[0].tenant_id, A); assert.equal(rows[0].type, 'receita');
  });
  await check('B nao consegue dar baixa em pagamento do A', async () => {
    const other = (await one("INSERT INTO payments (tenant_id, sale_id, customer_id, type, codigo_solicitacao, status, value, customer_name, due_date) VALUES ($1,NULL,$2,'boleto','COD-X','a_receber',50,'Cliente A',$3) RETURNING id", [A, cust, day])).id;
    const r = await call('POST', '/inter/payments/' + other + '/mark-received', tokenB, { receivedValue: 50 });
    assert.ok([403, 404].includes(r.status), 'status ' + r.status);
    assert.equal((await one('SELECT status FROM payments WHERE id=$1', [other])).status, 'a_receber');
  });

  console.log('Financeiro e DRE');
  await check('movimentos financeiros: cada tenant ve so os seus', async () => {
    const a = await call('GET', '/financial/movements', tokenA);
    const b = await call('GET', '/financial/movements', tokenB);
    assert.equal(a.status, 200);
    assert.ok(a.json.length >= 3);
    assert.ok(a.json.every((m) => m.tenantId === A));
    assert.equal(b.json.length, 1);
    assert.equal(Number(b.json[0].value), 7777);
  });
  await check('DRE do A soma venda recebida, multa e contrato (receita 2260) e nada do B', async () => {
    const y = new Date().getFullYear();
    const m = new Date().getMonth() + 1;
    const r = await call('GET', `/reports/dre?year=${y}&month=${m}`, tokenA);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(Number(r.json.totals.receitaBruta), 2260);
    assert.equal(Number(r.json.months[0].despesasFixas), 300);
    assert.equal(Number(r.json.months[0].contasPagas), 250);
  });
  await check('DRE do B usa so os numeros do B (receita 7777)', async () => {
    const y = new Date().getFullYear();
    const m = new Date().getMonth() + 1;
    const r = await call('GET', `/reports/dre?year=${y}&month=${m}`, tokenB);
    assert.equal(Number(r.json.totals.receitaBruta), 7777);
  });

  console.log('Corrigir valor recebido de pagamento ja baixado');
  const sale2 = (await one("INSERT INTO sales (tenant_id, technician_id, customer_id, payment_method, subtotal, total_amount, installments) VALUES ($1,$2,$3,'boleto',600,600,1) RETURNING id", [A, tech, cust])).id;
  const pay2 = (await one("INSERT INTO payments (tenant_id, sale_id, customer_id, type, codigo_solicitacao, status, value, customer_name, due_date) VALUES ($1,$2,$3,'boleto','COD-VENDA-2','a_receber',600,'Cliente A',$4) RETURNING id", [A, sale2, cust, day])).id;
  const adjust = (id, token, receivedValue) => call('PATCH', '/inter/payments/' + id + '/received-value', token, { receivedValue });
  const sumMov = async (code) => Number((await one("SELECT COALESCE(SUM(CASE WHEN type='receita' THEN value ELSE -value END),0) t FROM financial_movements WHERE category='multa_juros' AND idempotency_key LIKE $1 OR (category='multa_juros' AND type='estorno' AND reference_id IN (SELECT id FROM financial_movements WHERE idempotency_key LIKE $1))", ['latefee:' + code + '%'])).t);
  await check('pagamento ainda nao baixado nao pode ter o valor recebido corrigido (400)', async () => {
    assert.equal((await adjust(pay2, tokenA, 640)).status, 400);
  });
  await call('POST', '/inter/payments/' + pay2 + '/mark-received', tokenA, { note: 'baixa antiga no valor original' });
  await check('baixa antiga no valor original: corrigir para 640 cria 40 de multa/juros no tenant A', async () => {
    const r = await adjust(pay2, tokenA, 640);
    assert.ok([200, 201].includes(r.status), r.status + JSON.stringify(r.json));
    assert.equal(Number((await one('SELECT received_value FROM payments WHERE id=$1', [pay2])).received_value), 640);
    const m = (await db.query("SELECT value, tenant_id, sale_id FROM financial_movements WHERE category='multa_juros' AND type='receita' AND idempotency_key LIKE 'latefee:COD-VENDA-2%'")).rows;
    assert.equal(m.length, 1); assert.equal(Number(m[0].value), 40); assert.equal(m[0].tenant_id, A); assert.equal(m[0].sale_id, sale2);
  });
  await check('corrigir de novo para 650 soma so a diferenca (mais 10), sem mexer no lancamento antigo', async () => {
    assert.ok([200, 201].includes((await adjust(pay2, tokenA, 650)).status));
    assert.equal(await sumMov('COD-VENDA-2'), 50);
  });
  await check('reduzir para 635 estorna 15 do ajuste (total de multa/juros 35)', async () => {
    assert.ok([200, 201].includes((await adjust(pay2, tokenA, 635)).status));
    assert.equal(await sumMov('COD-VENDA-2'), 35);
    assert.equal(Number((await one('SELECT received_value FROM payments WHERE id=$1', [pay2])).received_value), 635);
  });
  await check('voltar ao valor original (600) zera a multa/juros', async () => {
    assert.ok([200, 201].includes((await adjust(pay2, tokenA, 600)).status));
    assert.equal(await sumMov('COD-VENDA-2'), 0);
  });
  await check('valor menor que o original e recusado (400) e o registro nao muda', async () => {
    const r = await adjust(pay2, tokenA, 590); assert.equal(r.status, 400); assert.match(String(r.json.message), /menor que o valor original/);
    assert.equal(Number((await one('SELECT received_value FROM payments WHERE id=$1', [pay2])).received_value), 600);
  });
  await check('valor igual ao registrado e invalido/zero sao recusados (400)', async () => {
    assert.equal((await adjust(pay2, tokenA, 600)).status, 400);
    assert.equal((await adjust(pay2, tokenA, 0)).status, 400);
    assert.equal((await adjust(pay2, tokenA, 'abc')).status, 400);
  });
  await check('outro tenant nao consegue corrigir o valor (404) e financeiro nao e alterado', async () => {
    const before = await sumMov('COD-VENDA-2');
    assert.equal((await adjust(pay2, tokenB, 700)).status, 404);
    assert.equal(await sumMov('COD-VENDA-2'), before);
  });
  await check('contrato com lancamento (630): subir para 650 soma 20; reduzir abaixo do ja registrado e recusado', async () => {
    assert.ok([200, 201].includes((await adjust(contractPay, tokenA, 650)).status));
    assert.equal(await sumMov('COD-CONTRATO-1'), 20);
    const low = await adjust(contractPay, tokenA, 625);
    assert.equal(low.status, 400, JSON.stringify(low.json));
  });
  await check('contrato antigo sem lancamento: so atualiza o valor recebido (sem criar lancamento, sem contar em dobro)', async () => {
    const old = (await one("INSERT INTO payments (tenant_id, sale_id, customer_id, type, codigo_solicitacao, status, value, customer_name, due_date, paid_at) VALUES ($1,NULL,$2,'boleto','COD-CONTRATO-OLD','pago',500,'Cliente A',$3, now()) RETURNING id", [A, cust, day])).id;
    await db.query("INSERT INTO contract_billings (contract_id, customer_id, billing_period, due_date, value, boleto_code) VALUES ($1,$2,$3,$4,500,'COD-CONTRATO-OLD')", [contract, cust, month.slice(0, 4) + '-99', day]);
    assert.ok([200, 201].includes((await adjust(old, tokenA, 560)).status));
    assert.equal(Number((await one('SELECT received_value FROM payments WHERE id=$1', [old])).received_value), 560);
    assert.equal(Number((await one("SELECT COUNT(*) c FROM financial_movements WHERE idempotency_key LIKE 'contract:COD-CONTRATO-OLD%' OR idempotency_key LIKE 'latefee:COD-CONTRATO-OLD%'")).c), 0);
  });
  await check('DRE do A reflete os ajustes (receitas - reducoes + contrato antigo recebido a mais)', async () => {
    const y = new Date().getFullYear(); const m = new Date().getMonth() + 1;
    const rec = Number((await one("SELECT COALESCE(SUM(value),0) t FROM financial_movements WHERE tenant_id=$1 AND type='receita' AND is_forecast=false AND to_char(date,'YYYY-MM')=$2", [A, month])).t);
    const red = Number((await one("SELECT COALESCE(SUM(value),0) t FROM financial_movements WHERE tenant_id=$1 AND type='estorno' AND reference_type='multa_juros_adjustment' AND is_forecast=false AND to_char(date,'YYYY-MM')=$2", [A, month])).t);
    const r = await call('GET', '/reports/dre?year=' + y + '&month=' + m, tokenA);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(Number(r.json.totals.receitaBruta), rec - red + 560, 'receita do DRE deve = lancamentos - reducoes + contrato antigo (560)');
  });
  await check('nenhuma chamada ao Banco Inter: o ajuste e so no sistema (auditoria registrada)', async () => {
    const a = await one("SELECT COUNT(*) c FROM audit_logs WHERE action='inter.received_value_adjusted'");
    assert.ok(Number(a.c) >= 5);
  });

  console.log('E-mail por tenant (cada empresa configura o proprio)');
  await check('tenant sem e-mail configurado: config indica configured=false e o teste de envio e recusado', async () => {
    const cfg = await call('GET', '/mail/config', tokenB);
    assert.equal(cfg.status, 200); assert.equal(cfg.json.configured, false);
    assert.equal(cfg.json.host, '', 'o tenant novo nao pode herdar o servidor da plataforma');
    const r = await call('POST', '/mail/test', tokenB, { email: 'destino@exemplo.com' });
    assert.equal(r.status, 400); assert.match(String(r.json.message), /não configurado|nao configurado/i);
  });
  await check('tenant configura a propria conta SMTP e passa a constar como configurado', async () => {
    const save = await call('PATCH', '/mail/config', tokenA, { host: '127.0.0.1', port: 1, authUser: 'u@a.test', authPass: 'segredo', fromEmail: 'u@a.test', fromName: 'Empresa A', provider: 'smtp' });
    assert.ok([200, 201].includes(save.status), save.status + JSON.stringify(save.json));
    assert.equal((await call('GET', '/mail/config', tokenA)).json.configured, true);
    const r = await call('POST', '/mail/test', tokenA, { email: 'destino@exemplo.com' });
    assert.equal(r.status, 400); assert.doesNotMatch(String(r.json.message), /não configurado|nao configurado/i, 'deve tentar enviar e falhar na conexao, nao na configuracao');
  });
  await check('a configuracao de um tenant nao aparece no outro', async () => {
    assert.equal((await call('GET', '/mail/config', tokenB)).json.configured, false);
    assert.equal((await call('GET', '/mail/config', tokenA)).json.fromName, 'Empresa A');
  });
  await check('historico de envios e por tenant', async () => {
    const a = await call('GET', '/mail/logs', tokenA); const b = await call('GET', '/mail/logs', tokenB);
    assert.ok((a.json.items || []).length >= 1); assert.ok((a.json.items || []).every((l) => l.tenantId === A));
    assert.ok((b.json.items || []).every((l) => l.tenantId === B));
  });
  await check('recuperacao de senha continua respondendo mesmo sem e-mail configurado no tenant', async () => {
    const r = await call('POST', '/auth/forgot-password', null, { email: 'admin-b@e2e.test' });
    assert.ok([200, 201].includes(r.status), String(r.status));
  });

  console.log('Painel do tecnico');
  const mkTech = async (t, email) => (await one("INSERT INTO users (tenant_id, name, email, password, role) VALUES ($1,'Tecnico Teste',$2,$3,'tecnico') RETURNING id", [t, email, hash])).id;
  const techA = await mkTech(A, 'tec-a@e2e.test');
  const techB = await mkTech(B, 'tec-b@e2e.test');
  const adminA = (await one("SELECT id FROM users WHERE tenant_id=$1 AND role='admin'", [A])).id;
  const custB = (await one("INSERT INTO customers (tenant_id, name) VALUES ($1,'Cliente B') RETURNING id", [B])).id;
  const os = (t, tech, customer, status, openedDaysAgo, extra = '') =>
    db.query("INSERT INTO service_orders (tenant_id, customer_id, technician_id, service_type, customer_report, status_key, opened_at" + (extra ? ', started_at, completed_at' : '') + ") VALUES ($1,$2,$3,'Manutencao','relato',$4, now() - ($5 || ' days')::interval" + (extra ? ", now() - interval '3 hours', now() - interval '1 hour'" : '') + ')', [t, customer, tech, status, String(openedDaysAgo)]);
  await os(A, techA, cust, 'em_manutencao', 2);
  await os(A, techA, cust, 'aguardando_cliente', 10);
  await os(A, techA, cust, 'concluida', 1, 'done');
  await os(A, adminA, cust, 'iniciando', 1);
  await os(B, techB, custB, 'iniciando', 1);
  for (const [km, value, st] of [[10, 13, 'pendente'], [20, 26, 'paga']]) {
    await db.query("INSERT INTO routes (tenant_id, technician_id, description, km, total_value, route_date, status) VALUES ($1,$2,'Visita cliente',$3,$4,$5,$6)", [A, techA, km, value, day, st]);
  }
  await db.query("INSERT INTO commissions (tenant_id, technician_id, type, base_value, percentage, amount, status) VALUES ($1,$2,'venda',1000,5,50,'pendente')", [A, techA]);
  await db.query("INSERT INTO commissions (tenant_id, technician_id, type, base_value, percentage, amount, status) VALUES ($1,$2,'venda',1000,5,999,'pendente')", [A, adminA]);
  await db.query("INSERT INTO sales (tenant_id, technician_id, customer_id, payment_method, subtotal, total_amount, installments, status) VALUES ($1,$2,$3,'pix',300,300,1,'pago')", [A, techA, cust]);
  const tokenTecA = await login('tec-a@e2e.test');
  const tokenTecB = await login('tec-b@e2e.test');
  await check('painel do tecnico A mostra so os numeros dele', async () => {
    const r = await call('GET', '/dashboard/technician', tokenTecA);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const d = r.json;
    assert.equal(d.serviceOrders.open, 2); assert.equal(d.serviceOrders.stale, 1); assert.equal(d.serviceOrders.completedMonth, 1);
    assert.ok(Math.abs(d.serviceOrders.avgHoursToComplete - 2) < 0.2, 'media de horas ' + d.serviceOrders.avgHoursToComplete);
    assert.deepEqual(d.serviceOrders.active.map((o) => o.statusKey), ['aguardando_cliente', 'em_manutencao'], 'mais antigas primeiro');
    assert.equal(d.serviceOrders.active[0].customerName, 'Cliente A'); assert.ok(d.serviceOrders.active[0].daysOpen >= 10);
    assert.equal(d.routes.count, 2); assert.equal(d.routes.km, 30); assert.equal(d.routes.totalValue, 39);
    assert.equal(d.routes.byStatus.pendente.count, 1); assert.equal(d.routes.byStatus.paga.value, 26);
    assert.equal(d.commissions.pending, 50);
    assert.equal(d.sales.count, 1); assert.equal(d.sales.total, 300); assert.equal(d.sales.paid, 300);
  });
  await check('tecnico de outro tenant nao ve nada do A', async () => {
    const d = (await call('GET', '/dashboard/technician', tokenTecB)).json;
    assert.equal(d.serviceOrders.open, 1); assert.equal(d.serviceOrders.active[0].customerName, 'Cliente B');
    assert.equal(d.routes.count, 0); assert.equal(d.commissions.pending, 0); assert.equal(d.sales.count, 0);
  });
  await check('mes anterior vem zerado e mes invalido cai no mes atual', async () => {
    const prev = new Date(); prev.setMonth(prev.getMonth() - 1, 1);
    const m = prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0');
    const d = (await call('GET', '/dashboard/technician?month=' + m, tokenTecA)).json;
    assert.equal(d.month, m); assert.equal(d.routes.count, 0); assert.equal(d.serviceOrders.completedMonth, 0);
    assert.equal((await call('GET', '/dashboard/technician?month=lixo', tokenTecA)).json.month, month);
  });
  await check('tecnico nao pode corrigir valor recebido (403)', async () => {
    assert.equal((await adjust(pay2, tokenTecA, 700)).status, 403);
  });
  await check('admin e financeiro nao acessam o painel do tecnico (403) e sem login (401)', async () => {
    assert.equal((await call('GET', '/dashboard/technician', tokenA)).status, 403);
    assert.equal((await call('GET', '/dashboard/technician')).status, 401);
  });

  console.log('Numero do documento: NFS-e (nao a DPS)');
  const nfseSale = (await one("INSERT INTO sales (tenant_id, technician_id, customer_id, payment_method, subtotal, total_amount, installments, status, billing_status) VALUES ($1,$2,$3,'boleto',100,100,1,'pendente','emitido') RETURNING id", [A, tech, cust])).id;
  await db.query("INSERT INTO invoices (tenant_id, sale_id, type, number, status, xml_authorized, issued_at) VALUES ($1,$2,'nfse',7,'autorizada','<NFSe><infNFSe><nNFSe>1234</nNFSe><DPS><infDPS><nDPS>7</nDPS></infDPS></DPS></infNFSe></NFSe>', now())", [A, nfseSale]);
  await db.query("INSERT INTO payments (tenant_id, sale_id, customer_id, type, codigo_solicitacao, status, value, customer_name, due_date) VALUES ($1,$2,$3,'boleto','COD-NFSE-1','a_receber',100,'Cliente A',$4)", [A, nfseSale, cust, day]);
  const nfeSale = (await one("INSERT INTO sales (tenant_id, technician_id, customer_id, payment_method, subtotal, total_amount, installments, status, billing_status) VALUES ($1,$2,$3,'boleto',100,100,1,'pendente','emitido') RETURNING id", [A, tech, cust])).id;
  await db.query("INSERT INTO invoices (tenant_id, sale_id, type, number, status, issued_at) VALUES ($1,$2,'nfe',555,'autorizada', now())", [A, nfeSale]);
  await db.query("INSERT INTO payments (tenant_id, sale_id, customer_id, type, codigo_solicitacao, status, value, customer_name, due_date) VALUES ($1,$2,$3,'boleto','COD-NFE-1','a_receber',100,'Cliente A',$4)", [A, nfeSale, cust, day]);
  const noXmlSale = (await one("INSERT INTO sales (tenant_id, technician_id, customer_id, payment_method, subtotal, total_amount, installments, status, billing_status) VALUES ($1,$2,$3,'boleto',100,100,1,'pendente','emitido') RETURNING id", [A, tech, cust])).id;
  await db.query("INSERT INTO invoices (tenant_id, sale_id, type, number, status, issued_at) VALUES ($1,$2,'nfse',9,'autorizada', now())", [A, noXmlSale]);
  await db.query("INSERT INTO payments (tenant_id, sale_id, customer_id, type, codigo_solicitacao, status, value, customer_name, due_date) VALUES ($1,$2,$3,'boleto','COD-NFSE-SEMXML','a_receber',100,'Cliente A',$4)", [A, noXmlSale, cust, day]);
  await check('lista de pagamentos mostra o numero da NFS-e (1234) e nao o da DPS (7)', async () => {
    const r = await call('GET', '/inter/payments?limit=100&page=1&month=' + month, tokenA);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const row = (r.json.data || []).find((p) => p.codigoSolicitacao === 'COD-NFSE-1');
    assert.ok(row, 'pagamento nao listado');
    assert.equal(String(row.invoiceNumber), '1234'); assert.equal(String(row.invoiceDpsNumber), '7');
  });
  await check('NF-e continua mostrando o proprio numero e NFS-e sem XML cai no numero reservado', async () => {
    const rows = (await call('GET', '/inter/payments?limit=100&page=1&month=' + month, tokenA)).json.data;
    assert.equal(String(rows.find((p) => p.codigoSolicitacao === 'COD-NFE-1').invoiceNumber), '555');
    assert.equal(String(rows.find((p) => p.codigoSolicitacao === 'COD-NFSE-SEMXML').invoiceNumber), '9');
  });

  console.log('Inadimplencia das vendas');
  const brt = (offsetDays) => new Date(Date.now() - 3 * 3600000 + offsetDays * 86400000).toISOString().split('T')[0];
  const mkSale = async (dueDate) => (await one("INSERT INTO sales (tenant_id, technician_id, customer_id, payment_method, subtotal, total_amount, installments, status, billing_status, due_date) VALUES ($1,$2,$3,'boleto',300,300,2,'pendente','emitido',$4) RETURNING id", [A, tech, cust, dueDate])).id;
  const mkPay = (sale, code, status, due) => db.query("INSERT INTO payments (tenant_id, sale_id, customer_id, type, codigo_solicitacao, status, value, customer_name, due_date) VALUES ($1,$2,$3,'boleto',$4,$5,150,'Cliente A',$6)", [A, sale, cust, code, status, due]);
  const firstPaid = await mkSale(brt(-40)); await mkPay(firstPaid, 'COD-INAD-1A', 'pago', brt(-40)); await mkPay(firstPaid, 'COD-INAD-1B', 'a_receber', brt(+20));
  const dueToday = await mkSale(brt(0)); await mkPay(dueToday, 'COD-INAD-2', 'a_receber', brt(0));
  const trulyLate = await mkSale(brt(-3)); await mkPay(trulyLate, 'COD-INAD-3', 'a_receber', brt(-3));
  const reissued = await mkSale(brt(-15)); await mkPay(reissued, 'COD-INAD-4A', 'cancelado', brt(-15)); await mkPay(reissued, 'COD-INAD-4B', 'a_receber', brt(+5));
  const salesList = async () => { const r = await call('GET', '/sales?limit=200&page=1', tokenA); assert.equal(r.status, 200, JSON.stringify(r.json)); return r.json.data || r.json; };
  await check('venda com a 1a parcela paga e a 2a a vencer NAO e inadimplente', async () => {
    const sale = (await salesList()).find((x) => x.id === firstPaid);
    assert.notEqual(sale.paymentStatus, 'inadimplente'); assert.equal(sale.nextDueDate, brt(+20));
  });
  await check('venda que vence HOJE (horario de Brasilia) NAO e inadimplente', async () => {
    const sale = (await salesList()).find((x) => x.id === dueToday);
    assert.notEqual(sale.paymentStatus, 'inadimplente'); assert.equal(sale.nextDueDate, brt(0));
  });
  await check('venda com boleto vencido ontem ou antes E inadimplente', async () => {
    const sale = (await salesList()).find((x) => x.id === trulyLate);
    assert.equal(sale.paymentStatus, 'inadimplente');
  });
  await check('boleto reemitido com nova data em dia NAO e inadimplente (vencimento antigo da venda ignorado)', async () => {
    const sale = (await salesList()).find((x) => x.id === reissued);
    assert.notEqual(sale.paymentStatus, 'inadimplente'); assert.equal(sale.nextDueDate, brt(+5));
  });

  console.log('Relatorio por tipo');
  await check('relatorio de creditos, debitos e completo geram PDF; tipo invalido da 400', async () => {
    const start = month + '-01'; const end = month + '-28';
    for (const [type, suffix] of [['all', ''], ['credits', '-creditos'], ['debits', '-debitos']]) {
      const res = await fetch(API + '/api/financial/cash-flow-report/pdf?startDate=' + start + '&endDate=' + end + '&type=' + type, { headers: { authorization: 'Bearer ' + tokenA } });
      assert.equal(res.status, 200, type); assert.equal(Buffer.from(await res.arrayBuffer()).subarray(0, 4).toString(), '%PDF');
      assert.ok((res.headers.get('content-disposition') || '').includes('fluxo-de-caixa' + suffix + '-'), type + ' ' + res.headers.get('content-disposition'));
    }
    const bad = await fetch(API + '/api/financial/cash-flow-report/pdf?startDate=' + start + '&endDate=' + end + '&type=outro', { headers: { authorization: 'Bearer ' + tokenA } });
    assert.equal(bad.status, 400);
  });

  console.log('Relatorio PDF');
  await check('fluxo de caixa em PDF: gera para o tenant A e exige perfil/login', async () => {
    const start = month + '-01'; const end = month + '-28';
    const res = await fetch(API + '/api/financial/cash-flow-report/pdf?startDate=' + start + '&endDate=' + end, { headers: { authorization: 'Bearer ' + tokenA } });
    assert.equal(res.status, 200); assert.ok((res.headers.get('content-type') || '').includes('application/pdf'));
    const buf = Buffer.from(await res.arrayBuffer()); assert.equal(buf.subarray(0, 4).toString(), '%PDF'); assert.ok(buf.length > 1500);
    assert.equal((await fetch(API + '/api/financial/cash-flow-report/pdf?startDate=' + start + '&endDate=' + end)).status, 401);
  });

  console.log('Configuracao por tenant');
  await check('empresa: A salva e B nao ve', async () => {
    assert.ok([200, 201].includes((await call('PATCH', '/company-profile', tokenA, { razaoSocial: 'A LTDA', cnpj: '11' })).status));
    assert.equal((await call('GET', '/company-profile', tokenA)).json.razaoSocial, 'A LTDA');
    assert.equal((await call('GET', '/company-profile', tokenB)).json.razaoSocial, undefined);
  });
  await check('fiscal: tenantId no corpo e ignorado e B nao ve a config do A', async () => {
    const r = await call('PATCH', '/fiscal/config', tokenA, { cnpj: '99999999000199', companyName: 'A FISCAL', tenantId: B });
    assert.ok([200, 201].includes(r.status), r.status + JSON.stringify(r.json));
    assert.equal((await one("SELECT tenant_id FROM fiscal_config WHERE cnpj='99999999000199'")).tenant_id, A);
    assert.equal((await call('GET', '/fiscal/config', tokenB)).json.companyName, '');
  });

  console.log('Seguranca da API');
  await check('CORS: origem desconhecida nao recebe Access-Control-Allow-Origin', async () => {
    const r = await call('GET', '/health', null, null, { origin: 'http://evil.example' });
    assert.equal(r.headers.get('access-control-allow-origin'), null);
  });
  await check('CORS: origem configurada e aceita', async () => {
    const r = await call('GET', '/health', null, null, { origin: 'http://localhost:5173' });
    assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  });
  await check('cabecalhos de seguranca presentes', async () => {
    const r = await call('GET', '/health');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
  });
  await check('sem token a API recusa (401)', async () => {
    assert.equal((await call('GET', '/products')).status, 401);
  });

  console.log(`\n${passed} verificacoes passaram${process.exitCode ? ', COM FALHAS' : ''}.`);
  await db.end();
})().catch((e) => { console.error('ERRO NO TESTE', e); process.exit(1); });
