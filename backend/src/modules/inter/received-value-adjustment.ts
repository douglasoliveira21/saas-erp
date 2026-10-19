import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { insertWithTenant } from '../../common/tenant/tenant-scope';

const round2 = (v: number) => Math.round(v * 100) / 100;

// reference_type próprio: o banco só aceita UM estorno 'financial_movement_reversal' por lançamento
// (idx_movement_single_reversal), e um ajuste pode ser reduzido mais de uma vez.
export const ADJUSTMENT_REFERENCE_TYPE = 'multa_juros_adjustment';

export interface ReceivedValueAdjustment {
  paymentId: string;
  previousReceived: number;
  newReceived: number;
  nominal: number;
  delta: number;
  adjustmentMovements: number;
  saleId: string | null;
  codigoSolicitacao: string;
}

/**
 * Corrige o valor RECEBIDO de um boleto/PIX já baixado (pago com multa e juros, mas gravado só com o
 * valor original). O banco proíbe alterar lançamento realizado, então o ajuste entra como lançamento
 * NOVO de multa/juros (ou estorno de um ajuste anterior, ao reduzir) - nunca como edição do antigo.
 * O valor original da cobrança é o piso: este ajuste cobre multa/juros, não desconto.
 */
export async function adjustReceivedValue(
  manager: EntityManager,
  params: { id: string; receivedValue: number; tenantId: string | null },
): Promise<ReceivedValueAdjustment> {
  const newReceived = round2(Number(params.receivedValue));
  if (!Number.isFinite(newReceived) || newReceived <= 0) throw new BadRequestException('Informe um valor recebido válido, maior que zero.');

  const rows = await manager.query(
    `SELECT id, sale_id, status, value, received_value, codigo_solicitacao, installment_id, paid_at, type
     FROM payments WHERE id=$1${params.tenantId ? ' AND tenant_id=$2' : ''} FOR UPDATE`,
    params.tenantId ? [params.id, params.tenantId] : [params.id],
  );
  const payment = rows[0];
  if (!payment) throw new NotFoundException('Pagamento não encontrado');
  if (payment.status !== 'pago') throw new BadRequestException('Só é possível corrigir o valor de um pagamento que já foi recebido.');

  const nominal = round2(Number(payment.value));
  if (newReceived < nominal - 0.009) {
    throw new BadRequestException(`O valor recebido não pode ser menor que o valor original da cobrança (R$ ${nominal.toFixed(2)}). Este ajuste serve para multa e juros.`);
  }
  const previousReceived = round2(Number(payment.received_value ?? nominal));
  if (Math.abs(newReceived - previousReceived) < 0.01) throw new BadRequestException('O valor informado é igual ao já registrado.');

  const code: string = payment.codigo_solicitacao || '';
  const isContract = !payment.sale_id;
  const paidAt: Date = payment.paid_at ? new Date(payment.paid_at) : new Date();
  const paidDate = paidAt.toISOString().split('T')[0];

  // Lançamentos já gravados para esta cobrança.
  const contractMovement = isContract && code
    ? (await manager.query(`SELECT id, value FROM financial_movements WHERE idempotency_key = $1 LIMIT 1`, ['contract:' + code]))[0]
    : null;
  const extras: Array<{ id: string; value: number; reversed: number }> = [];
  if (code) {
    const found = await manager.query(
      `SELECT id, value FROM financial_movements WHERE type='receita' AND category='multa_juros' AND is_forecast=false AND idempotency_key LIKE $1 ORDER BY created_at ASC`,
      ['latefee:' + code + '%'],
    );
    for (const row of found) {
      const reversed = await manager.query(
        `SELECT COALESCE(SUM(value),0) AS total FROM financial_movements WHERE type='estorno' AND reference_type IN ('financial_movement_reversal', 'multa_juros_adjustment') AND reference_id=$1`,
        [row.id],
      );
      extras.push({ id: row.id, value: Number(row.value), reversed: Number(reversed[0]?.total || 0) });
    }
  }
  const extraNet = round2(extras.reduce((s, e) => s + e.value - e.reversed, 0));

  let adjustmentMovements = 0;
  // Contrato antigo sem lançamento próprio: os relatórios leem direto de payments (received_value),
  // então atualizar a coluna basta - criar lançamento aqui contaria o valor em dobro.
  const hasLedger = !isContract || Boolean(contractMovement);
  if (hasLedger) {
    const base = isContract ? round2(Number(contractMovement.value)) : nominal;
    const delta = round2(newReceived - (base + extraNet));

    if (delta > 0.009) {
      const accountRow = payment.sale_id ? (await manager.query(`SELECT id FROM accounts_receivable WHERE sale_id=$1 LIMIT 1`, [payment.sale_id]))[0] : null;
      await insertWithTenant(
        manager,
        `INSERT INTO financial_movements (type, category, description, value, date, paid_at, sale_id, account_id, installment_id, payment_method, is_forecast, idempotency_key)
         VALUES ('receita', 'multa_juros', $1, $2, $3, $4, $5, $6, $7, $8, false, $9)`,
        [
          isContract ? `Multa e juros por atraso - contrato (cobrança ${code})` : `Multa e juros por atraso - venda #${String(payment.sale_id).substring(0, 8)}`,
          delta, paidDate, paidAt, payment.sale_id || null, accountRow?.id || null, payment.installment_id || null, payment.type || 'boleto',
          `latefee:${code}:adj:${Date.now()}`,
        ],
      );
      adjustmentMovements = 1;
    } else if (delta < -0.009) {
      let remaining = round2(-delta);
      if (remaining > extraNet + 0.009) {
        throw new BadRequestException(`Só é possível reduzir o que foi lançado como multa/juros (R$ ${extraNet.toFixed(2)}). O valor mínimo para esta cobrança é R$ ${round2(base).toFixed(2)}.`);
      }
      // Estorna do ajuste mais recente para o mais antigo.
      for (const extra of [...extras].reverse()) {
        if (remaining <= 0.009) break;
        const available = round2(extra.value - extra.reversed);
        const take = round2(Math.min(available, remaining));
        if (take <= 0.009) continue;
        await insertWithTenant(
          manager,
          `INSERT INTO financial_movements (type, category, description, value, date, paid_at, sale_id, payment_method, is_forecast, reference_id, reference_type)
           VALUES ('estorno', 'multa_juros', $1, $2, $3, $4, $5, $6, false, $7, 'multa_juros_adjustment')`,
          [`Ajuste de multa/juros (redução) - cobrança ${code}`, take, paidDate, paidAt, payment.sale_id || null, payment.type || 'boleto', extra.id],
        );
        remaining = round2(remaining - take);
        adjustmentMovements++;
      }
    }
  }

  await manager.query(`UPDATE payments SET received_value=$2::numeric, updated_at=NOW() WHERE id=$1`, [params.id, newReceived]);

  return {
    paymentId: params.id,
    previousReceived,
    newReceived,
    nominal,
    delta: round2(newReceived - previousReceived),
    adjustmentMovements,
    saleId: payment.sale_id || null,
    codigoSolicitacao: code,
  };
}
