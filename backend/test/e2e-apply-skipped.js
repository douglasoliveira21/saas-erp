// Aplica, uma a uma, as migracoes 1792300000000..1794000000000 que o e2e-provision.sh marcou como
// feitas (algumas conflitam com o schema criado pelas entidades e sao ignoradas; as que adicionam
// colunas como payments.tenant_id precisam rodar de verdade). Uso interno do provisionamento.
require('reflect-metadata');
const fs = require('node:fs');
const path = require('node:path');
const { DataSource } = require('typeorm');

(async () => {
  const ds = new DataSource({ type: 'postgres', url: 'postgres://postgres@127.0.0.1:54329/e2e_http' });
  await ds.initialize();
  const dir = path.resolve(__dirname, '..', 'dist', 'database', 'migrations');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort()) {
    const ts = Number(file.split('-')[0]);
    if (ts < 1792300000000 || ts > 1794000000000) continue;
    const Migration = Object.values(require(path.join(dir, file)))[0];
    const runner = ds.createQueryRunner();
    await runner.connect();
    try { await new Migration().up(runner); console.log('  ok    ', file); } catch (e) { console.log('  ignorada', file, '->', String(e.message).slice(0, 70)); }
    await runner.release();
  }
  await ds.destroy();
})();
