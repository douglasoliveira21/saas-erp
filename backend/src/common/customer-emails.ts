export function getCustomerEmails(customer: any): string[] {
  const additional = Array.isArray(customer?.additionalEmails)
    ? customer.additionalEmails
    : String(customer?.additionalEmails || '').split(/[;,\n]/);
  const values = [customer?.email, ...additional]
    .flatMap(value => String(value || '').split(/[;,\n]/))
    .map(value => value.trim().toLowerCase())
    .filter(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
  return Array.from(new Set(values));
}

export function getCustomerEmailRecipients(customer: any): string {
  return getCustomerEmails(customer).join(', ');
}

export function normalizeAdditionalEmails(value: any): string[] {
  return getCustomerEmails({ additionalEmails: value });
}
