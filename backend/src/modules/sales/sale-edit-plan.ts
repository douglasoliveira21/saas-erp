import { money, moneyMultiply, moneySum } from '../../common/money';

export type SaleEditAction = 'none' | 'boleto' | 'documents';

export function saleEditPlan(before: any, after: any, hasBoleto: boolean, hasInvoice: boolean) {
  const valueChanged = money(before.totalAmount) !== money(after.totalAmount);
  const installmentChanged = Number(before.installments || 1) !== Number(after.installments || 1);
  const customerChanged = before.customerId !== after.customerId;
  const paymentChanged = before.paymentMethod !== after.paymentMethod;
  const fiscalItems = (items: any[]) => (items || []).map(item => [
    item.productId || null, item.serviceId || null, item.name,
    Number(item.quantity), money(item.unitPrice),
  ]);
  const itemsChanged = JSON.stringify(fiscalItems(before.items)) !== JSON.stringify(fiscalItems(after.items));
  const dateChanged = String(before.dueDate || '').slice(0, 10) !== String(after.dueDate || '').slice(0, 10);
  const financialChanged = valueChanged || installmentChanged || paymentChanged;
  const fiscalChanged = financialChanged || customerChanged || itemsChanged;
  const action: SaleEditAction = fiscalChanged && (hasInvoice || hasBoleto) ? 'documents' :
    dateChanged && hasBoleto ? 'boleto' : 'none';
  return { action, financialChanged, fiscalChanged, dateChanged, itemsChanged };
}

export function normalizeSaleEdit(sale: any, changes: any) {
  const items = (changes.items ?? sale.items).map((item: any) => {
    const quantity = Number(item.quantity);
    const unitPrice = money(Number(item.unitPrice));
    const costPrice = money(Number(item.costPrice || 0));
    const taxPercentage = Number(item.taxPercentage || 0);
    if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0 ||
        !Number.isFinite(costPrice) || costPrice < 0 || !Number.isFinite(taxPercentage) || taxPercentage < 0) {
      throw new Error('Informe valores e quantidades válidos para os itens.');
    }
    const totalPrice = moneyMultiply(unitPrice, quantity);
    const taxAmount = moneyMultiply(totalPrice, taxPercentage / 100);
    return { productId: item.productId || null, serviceId: item.serviceId || null,
      name: item.name, quantity, unitPrice, costPrice, taxPercentage, totalPrice, taxAmount,
      netProfit: money(totalPrice - moneyMultiply(costPrice, quantity) - taxAmount) };
  });
  if (!items.length) throw new Error('Adicione pelo menos um item.');
  const subtotal = moneySum(items.map((item: any) => item.totalPrice));
  const discountAmount = money(Number(changes.discountAmount ?? changes.discountValue ?? sale.discountAmount ?? 0));
  if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > subtotal) throw new Error('Desconto inválido.');
  const totalAmount = money(subtotal - discountAmount);
  const commissionPercentage = Number(changes.commissionPercentage ?? sale.commissionPercentage ?? 0);
  if (!Number.isFinite(commissionPercentage) || commissionPercentage < 0 || commissionPercentage > 100) throw new Error('Comissão inválida.');
  const commissionAmount = moneyMultiply(totalAmount, commissionPercentage / 100);
  const taxAmount = moneySum(items.map((item: any) => item.taxAmount));
  const totalCost = moneySum(items.map((item: any) => moneyMultiply(item.costPrice, item.quantity)));
  return {
    customerId: changes.customerId ?? sale.customerId,
    technicianId: changes.technicianId ?? sale.technicianId,
    paymentMethod: changes.paymentMethod ?? sale.paymentMethod,
    installments: Number(changes.installments ?? sale.installments ?? 1),
    dueDate: changes.dueDate === undefined ? sale.dueDate : changes.dueDate,
    dueDay: changes.dueDay ?? sale.dueDay,
    multaPercentage: Number(changes.multaPercentage ?? sale.multaPercentage),
    moraPercentage: Number(changes.moraPercentage ?? sale.moraPercentage),
    saleType: changes.saleType ?? sale.saleType,
    observations: changes.observations ?? sale.observations,
    subtotal, discountAmount, taxAmount, totalAmount, commissionAmount, commissionPercentage,
    netProfit: money(totalAmount - totalCost - taxAmount - commissionAmount), items,
  };
}

