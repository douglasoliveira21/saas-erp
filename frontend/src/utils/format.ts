// Número vindo da API pode chegar null/undefined/NaN (coluna vazia, soma sem linhas, JSON de NaN).
// Chamar .toFixed() direto nele derruba a tela inteira ("Cannot read properties of null"), então
// todo valor que vem do servidor passa por aqui.
// Data de HOJE no fuso do navegador (AAAA-MM-DD). new Date().toISOString() devolve a data em UTC e, à noite no
// Brasil, já é "amanhã" - tudo que vence hoje passava a aparecer como atrasado.
export function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fixed(value: unknown, digits = 2): string {
  const n = Number(value)
  return (Number.isFinite(n) ? n : 0).toFixed(digits)
}
