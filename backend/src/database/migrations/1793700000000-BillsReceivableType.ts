import { MigrationInterface, QueryRunner } from 'typeorm';

export class BillsReceivableType1793700000000 implements MigrationInterface {
  name = 'BillsReceivableType1793700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 'bills' passa a servir tanto contas a pagar (fornecedor) quanto contas a receber avulsas
    // (cliente, sem venda vinculada) - supplier_id vira opcional e ganha um par customer_id/type.
    await queryRunner.query(`ALTER TABLE bills ALTER COLUMN supplier_id DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS type varchar(10) NOT NULL DEFAULT 'pagar'`);
    await queryRunner.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS customer_id uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bills DROP COLUMN IF EXISTS customer_id`);
    await queryRunner.query(`ALTER TABLE bills DROP COLUMN IF EXISTS type`);
    await queryRunner.query(`ALTER TABLE bills ALTER COLUMN supplier_id SET NOT NULL`);
  }
}
