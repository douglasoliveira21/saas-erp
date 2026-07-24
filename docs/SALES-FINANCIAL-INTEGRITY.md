# Integridade de vendas, financeiro, cobrança e fiscal

## Regras implementadas

- A situação operacional, fiscal, de cobrança e de pagamento da venda é armazenada separadamente.
- Boleto e nota não podem ser emitidos com vencimento anterior ao dia atual.
- Vendas finalizadas ou canceladas não podem emitir nota; vendas pagas podem emitir, desde que dentro do vencimento e ainda sem nota ativa.
- PIX e transferência não são considerados pagos apenas pela escolha da forma de pagamento.
- Baixas de parcelas bloqueiam a linha, exigem chave de idempotência e atualizam conta, venda, histórico e fluxo em uma transação.
- Webhook e conciliação do Inter confirmam a cobrança na API e usam a mesma transação financeira.
- Um movimento realizado é imutável; correções usam estorno.
- Exclusão de venda cancelada arquiva o registro e preserva o histórico.

## Deploy

Execute, nesta ordem, antes de iniciar a nova versão do backend:

```bash
npm run --workspace backend migration:run
npm run --workspace backend build
```

As migrations `1785000000000-SecurityAndFinancialIntegrity` e `1786000000000-SalesBillingFiscalIntegrity` devem constar como aplicadas.

A migration interrompe com uma mensagem clara se encontrar cobrança ou nota ativa duplicada para a mesma venda e tipo. Esses registros devem ser conciliados antes de repetir a migration.

## Verificação operacional

Após o deploy, um administrador ou usuário financeiro pode consultar:

```text
GET /api/financial/integrity-report
```

O resultado `consistent: true` indica que não foram encontradas divergências entre venda, conta, parcelas, cobrança e nota nos critérios automáticos.

## Baixa manual

A baixa manual de venda exige forma, data e o cabeçalho `Idempotency-Key`. Na interface, a baixa deve ser feita pela parcela no Financeiro; Banco Inter e conciliação fazem a baixa automaticamente.

## Segunda via vencida

A segunda via exige `newDueDate` no formato `AAAA-MM-DD`. A cobrança anterior é cancelada antes da nova emissão.