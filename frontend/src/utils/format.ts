// Número vindo da API pode chegar null/undefined/NaN (coluna vazia, soma sem linhas, JSON de NaN).
// Chamar .toFixed() direto nele derruba a tela inteira ("Cannot read properties of null"), então
// todo valor que vem do servidor passa por aqui.
export function fixed(value: unknown, digits = 2): string {
  const n = Number(value)
  return (Number.isFinite(n) ? n : 0).toFixed(digits)
}
