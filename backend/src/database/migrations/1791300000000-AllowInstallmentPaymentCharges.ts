import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowInstallmentPaymentCharges1791300000000 implements MigrationInterface {
  name = 'AllowInstallmentPaymentCharges1791300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Parcelas possuem idempotency_key própria. A unicidade antiga por venda/tipo
    // impedia que mais de um boleto ativo fosse registrado para a mesma venda.
    await queryRunner.query(`DROP INDEX IF EXISTS idx_payments_active_sale_type`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_active_sale_type ON payments(sale_id,type) WHERE status IN ('pendente','a_receber','vencido')`);
  }
}