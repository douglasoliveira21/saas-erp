import { MigrationInterface, QueryRunner } from 'typeorm';

// Catálogos de plataforma (não pertencem a nenhum tenant): municípios com provedor de NFS-e já
// mapeado e bancos com integração de boleto/pagamento disponível. Usados pela tela fiscal/financeira
// de cada tenant para autopreencher URLs e avisar quando algo ainda não está homologado (Fase 4/5
// do plano multi-tenant).
export class PlatformCatalogs1793200000000 implements MigrationInterface {
  name = 'PlatformCatalogs1793200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "municipalities" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(150) NOT NULL,
        "uf" varchar(2) NOT NULL,
        "ibge_code" varchar(7) NOT NULL,
        "provider" varchar(60),
        "nfse_api_url" varchar(500),
        "nfse_test_url" varchar(500),
        "status" varchar(20) NOT NULL DEFAULT 'nao_suportado',
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_municipalities" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_municipalities_ibge_code" UNIQUE ("ibge_code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "banks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(150) NOT NULL,
        "code" varchar(10),
        "has_integration" boolean NOT NULL DEFAULT false,
        "provider" varchar(60),
        "status" varchar(20) NOT NULL DEFAULT 'nao_suportado',
        "notes" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_banks" PRIMARY KEY ("id")
      )
    `);

    // Contagem/MG é o único município já em produção hoje (fiscal_config atual da VGON) — as
    // URLs vêm das mesmas variáveis de ambiente já usadas pelo NfseService, quando existirem, para
    // não duplicar configuração; se não existirem, fica em branco e o tenant preenche manualmente
    // como já fazia antes desta migração (não muda nada para quem já está funcionando).
    await queryRunner.query(
      `INSERT INTO "municipalities" ("name", "uf", "ibge_code", "provider", "nfse_api_url", "nfse_test_url", "status", "notes")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'Contagem', 'MG', '3118601', 'cidade360',
        process.env.CIDADE360_API_URL || null,
        process.env.CIDADE360_TEST_API_URL || null,
        'suportado',
        'Município em produção desde a implantação inicial do sistema.',
      ],
    );

    await queryRunner.query(
      `INSERT INTO "banks" ("name", "code", "has_integration", "provider", "status", "notes") VALUES
        ('Banco Inter', '077', true, 'inter', 'suportado', 'Integração ativa: emissão de boleto e conciliação automática via API do Banco Inter.'),
        ('Banco do Brasil', '001', false, NULL, 'nao_suportado', NULL),
        ('Bradesco', '237', false, NULL, 'nao_suportado', NULL),
        ('Itaú Unibanco', '341', false, NULL, 'nao_suportado', NULL),
        ('Santander', '033', false, NULL, 'nao_suportado', NULL),
        ('Caixa Econômica Federal', '104', false, NULL, 'nao_suportado', NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "banks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "municipalities"`);
  }
}
