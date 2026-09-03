import { MigrationInterface, QueryRunner } from 'typeorm';

// Credenciais do Banco Inter (ou de outro banco integrado no futuro) por tenant. Nenhuma linha é
// criada aqui para o tenant legado (VGON) de propósito: o InterService cai para as variáveis de
// ambiente globais quando não encontra config — zero migração de dados necessária, ninguém perde
// acesso. Isolar por tenant só passa a valer quando alguém realmente cadastrar uma linha aqui.
export class TenantBankConfig1793300000000 implements MigrationInterface {
  name = 'TenantBankConfig1793300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tenant_bank_configs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "bank_id" uuid,
        "environment" varchar(20) NOT NULL DEFAULT 'sandbox',
        "client_id" text,
        "client_secret" text,
        "certificate" text,
        "private_key" text,
        "pix_key" varchar(200),
        "account" varchar(60),
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenant_bank_configs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tenant_bank_configs_tenant" UNIQUE ("tenant_id"),
        CONSTRAINT "FK_tenant_bank_configs_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tenant_bank_configs_bank" FOREIGN KEY ("bank_id") REFERENCES "banks"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_bank_configs"`);
  }
}
