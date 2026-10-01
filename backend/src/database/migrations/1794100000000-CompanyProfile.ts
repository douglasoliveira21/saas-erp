import { MigrationInterface, QueryRunner } from 'typeorm';

// Dados cadastrais por tenant (razão social, CNPJ, logo etc) usados no cabeçalho de relatórios
// em PDF - separado de fiscal_config porque aquele é um singleton global amarrado à numeração
// de NF-e/NFS-e, enquanto isto é por tenant.
export class CompanyProfile1794100000000 implements MigrationInterface {
  name = 'CompanyProfile1794100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS company_profiles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL UNIQUE,
        razao_social varchar(255),
        cnpj varchar(20),
        inscricao_estadual varchar(30),
        inscricao_municipal varchar(30),
        cep varchar(10),
        endereco text,
        telefone varchar(30),
        logo text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS company_profiles`);
  }
}
