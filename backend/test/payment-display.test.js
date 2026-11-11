const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Executa os helpers usados pela tela sem precisar de navegador ou backend em execução.
const source = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/services/payment-display.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const exportsObject = {};
vm.runInNewContext(compiled.outputText, { exports: exportsObject, Date });
const { formatPaymentDueDate, showPaymentInLedger } = exportsObject;

test('vencimento 12/11 permanece 12/11 em Brasília com DATE ou ISO à meia-noite UTC', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'America/Sao_Paulo';
    assert.equal(formatPaymentDueDate('2026-11-12'), '12/11/2026');
    assert.equal(formatPaymentDueDate('2026-11-12T00:00:00.000Z'), '12/11/2026');
    assert.equal(formatPaymentDueDate('2027-01-01T00:00:00Z'), '01/01/2027');
    assert.equal(formatPaymentDueDate(''), '-');
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test('boleto substituído fica no histórico de cancelados e o novo continua na lista principal', () => {
  const oldPayment = { status: 'cancelado', superseded: true, dueDate: '2026-11-11' };
  const newPayment = { status: 'a_receber', superseded: false, dueDate: '2026-11-12' };
  assert.equal(showPaymentInLedger(oldPayment, ''), false);
  assert.equal(showPaymentInLedger(oldPayment, 'cancelado'), true);
  assert.equal(showPaymentInLedger(newPayment, ''), true);
  assert.equal(formatPaymentDueDate(newPayment.dueDate), '12/11/2026');
  assert.equal(showPaymentInLedger({ status: 'cancelado' }, ''), true);
});

