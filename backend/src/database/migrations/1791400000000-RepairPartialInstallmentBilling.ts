import { MigrationInterface, QueryRunner } from 'typeorm';

export class RepairPartialInstallmentBilling1791400000000 implements MigrationInterface {
  name = 'RepairPartialInstallmentBilling1791400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_payments_active_sale_type`);
    await queryRunner.query(`
      UPDATE sales sale
      SET billing_status = 'nao_emitido', updated_at = NOW()
      WHERE COALESCE(sale.installments, 1) > 1
        AND (
          SELECT COUNT(*)
          FROM payments payment
          WHERE payment.sale_id = sale.id
            AND payment.type = 'boleto'
            AND payment.status IN ('pendente','a_receber','vencido','pago')
        ) < COALESCE(sale.installments, 1)
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {}
}