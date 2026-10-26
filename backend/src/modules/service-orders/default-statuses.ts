// Status padrão de ordem de serviço criados para cada tenant (o super admin / admin pode editá-los depois).
export const DEFAULT_ORDER_STATUSES = [
  { key: 'iniciando', label: 'Iniciando', color: '#3b82f6', sortOrder: 1, isFinal: false },
  { key: 'cotando_pecas', label: 'Cotando peças', color: '#f59e0b', sortOrder: 2, isFinal: false },
  { key: 'em_manutencao', label: 'Realizando manutenção', color: '#8b5cf6', sortOrder: 3, isFinal: false },
  { key: 'aguardando_cliente', label: 'Aguardando cliente', color: '#eab308', sortOrder: 4, isFinal: false },
  { key: 'concluida', label: 'Concluída', color: '#22c55e', sortOrder: 5, isFinal: true },
  { key: 'cancelada', label: 'Cancelada', color: '#ef4444', sortOrder: 6, isFinal: true },
];
