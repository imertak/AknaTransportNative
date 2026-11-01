import type { Invoice, InvoiceFilter } from '@/types';

export function matchesInvoiceFilter(i: Invoice, f: InvoiceFilter): boolean {
  if (f.customerId && i.customerId !== f.customerId) return false;
  if (f.dateFrom && i.issueDate < f.dateFrom) return false;
  if (f.dateTo && i.issueDate > f.dateTo) return false;
  if (f.status) {
    const group =
      i.status === 'cancelled' ? 'cancelled' : i.status === 'earsiv_issued' ? 'issued' : i.status === 'earsiv_failed' ? 'failed' : 'draft';
    if (group !== f.status) return false;
  }
  return true;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function calculateInvoiceTotals(subtotal: number, vatRate: number) {
  const vatAmount = round2((subtotal * vatRate) / 100);
  return { subtotal: round2(subtotal), vatAmount, total: round2(subtotal + vatAmount) };
}
