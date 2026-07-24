export function money(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error('Valor monetário inválido');
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}
export function moneySum(values: unknown[]): number { return money(values.reduce<number>((sum, value) => sum + Number(value || 0), 0)); }
export function moneyMultiply(left: unknown, right: unknown): number { return money(Number(left) * Number(right)); }
