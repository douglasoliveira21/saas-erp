// "Hoje" no horário de Brasília (UTC-3, sem horário de verão desde 2019) no formato AAAA-MM-DD.
// new Date().toISOString() devolve a data em UTC: entre 21h e 24h em Brasília já é "amanhã" em UTC, e
// tudo que vence HOJE passava a contar como atrasado/inadimplente nessas horas.
export function todayInBrasilia(now: Date = new Date()): string {
  return new Date(now.getTime() - 3 * 3600000).toISOString().split('T')[0];
}

// Mesmo conceito para SQL cru (CURRENT_DATE usa o fuso do servidor do banco, normalmente UTC).
export const BRT_TODAY_SQL = "(NOW() AT TIME ZONE 'America/Sao_Paulo')::date";
