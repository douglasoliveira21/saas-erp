import { MigrationInterface, QueryRunner } from 'typeorm';

// Liga cada tenant a UM banco e UM município (catálogos de plataforma já existentes desde
// PlatformCatalogs) - até agora esses catálogos só existiam pra tela de config bancária/fiscal
// sugerir URLs, ninguém de fato gravava "esse tenant usa este banco/este município". Também
// adiciona Belo Horizonte e Betim ao catálogo de municípios (ambos migraram pro Emissor
// Nacional de NFS-e, não pro Cidade360 - por isso entram como 'nao_suportado': o catálogo já
// os conhece, mas a integração de verdade com o Emissor Nacional ainda não existe no sistema).
export class TenantBankMunicipality1793800000000 implements MigrationInterface {
  name = 'TenantBankMunicipality1793800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS bank_id uuid`);
    await q.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS municipality_id uuid`);
    // Postgres nao aceita "ADD CONSTRAINT IF NOT EXISTS" - o catch cobre uma segunda execucao
    // acidental da migration (a constraint ja existiria e o ALTER falharia com "already exists").
    await q.query(`
      ALTER TABLE tenants
      ADD CONSTRAINT "FK_tenants_bank" FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE SET NULL
    `).catch(() => {});
    await q.query(`
      ALTER TABLE tenants
      ADD CONSTRAINT "FK_tenants_municipality" FOREIGN KEY (municipality_id) REFERENCES municipalities(id) ON DELETE SET NULL
    `).catch(() => {});

    await q.query(`
      INSERT INTO municipalities (name, uf, ibge_code, provider, status, notes)
      VALUES
        ('Belo Horizonte', 'MG', '3106200', 'nfse_nacional', 'nao_suportado', 'Migrou do BHISS Digital para o Emissor Nacional de NFS-e (obrigatório desde 2026) - integração com o Emissor Nacional ainda não implementada neste sistema.'),
        ('Betim', 'MG', '3106705', 'nfse_nacional', 'nao_suportado', 'Adotou o Emissor Nacional de NFS-e (obrigatório desde 01/01/2026) - integração com o Emissor Nacional ainda não implementada neste sistema.')
      ON CONFLICT (ibge_code) DO NOTHING
    `);

    // Deixa explícito o que já é verdade hoje pro tenant legado (Contagem via Cidade360, Banco
    // Inter) - sem isso, /catalogs/my-tenant voltaria vazio pra ele e a tela ficaria pior do que
    // está hoje (que já mostra Contagem/Inter, só que sem essa ligação formal).
    await q.query(`
      UPDATE tenants t SET bank_id = b.id
      FROM banks b WHERE b.provider = 'inter' AND t.bank_id IS NULL
    `);
    await q.query(`
      UPDATE tenants t SET municipality_id = m.id
      FROM municipalities m WHERE m.ibge_code = '3118601' AND t.municipality_id IS NULL
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE tenants DROP CONSTRAINT IF EXISTS "FK_tenants_bank"`);
    await q.query(`ALTER TABLE tenants DROP CONSTRAINT IF EXISTS "FK_tenants_municipality"`);
    await q.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS bank_id`);
    await q.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS municipality_id`);
    await q.query(`DELETE FROM municipalities WHERE ibge_code IN ('3106200', '3106705')`);
  }
}
