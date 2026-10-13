import { MigrationInterface, QueryRunner } from 'typeorm';

// Valor efetivamente recebido no boleto/PIX (valorTotalRecebido do Inter). Difere de
// payments.value (valor nominal emitido) quando o cliente paga com multa e juros depois do
// vencimento - antes o sistema só guardava o nominal e o recebimento a mais se perdia.
export class PaymentReceivedValue1794200000000 implements MigrationInterface {
  name = 'PaymentReceivedValue1794200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS received_value numeric(12,2)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE payments DROP COLUMN IF EXISTS received_value`);
  }
}
