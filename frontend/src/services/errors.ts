export function getErrorMessage(error: unknown, fallback = 'Não foi possível concluir a operação') {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string | string[] } } }).response
    const message = response?.data?.message
    if (Array.isArray(message)) return message.join('. ')
    if (typeof message === 'string' && message.trim()) return message
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}
