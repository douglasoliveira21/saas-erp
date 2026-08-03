export function maskCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      .replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3')
      .replace(/(\d{3})(\d{1,3})/, '$1.$2')
  }
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    .replace(/(\d{2})(\d{3})(\d{3})(\d{1,4})/, '$1.$2.$3/$4')
    .replace(/(\d{2})(\d{3})(\d{1,3})/, '$1.$2.$3')
    .replace(/(\d{2})(\d{1,3})/, '$1.$2')
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/(\d{2})(\d{1,4})/, '($1) $2')
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/(\d{2})(\d{1,5})/, '($1) $2')
}

export function maskCep(value: string): string {
  return value.replace(/\D/g, '').replace(/(\d{5})(\d{0,3})/, '$1-$2')
}

export function maskCurrency(value: string): string {
  const digits = value.replace(/\D/g, '')
  const number = parseInt(digits) / 100
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
