import { http } from './http';

/**
 * Müşteri cari hesabı (AKNA API /api/customers/balances, /{id}/ledger, /{id}/transactions).
 * Kesilen (resmi) faturalar bakiyeye otomatik borç olarak yazılır; tahsilat, iade ve borç kayıtları elle girilir.
 */
export type TransactionType = 'Collection' | 'Refund' | 'Charge';
export type LedgerKind = 'Invoice' | 'Collection' | 'Refund' | 'Charge';

export const TRANSACTION_LABEL: Record<TransactionType, string> = {
  Collection: 'Tahsilat (gelen)',
  Refund: 'Ödeme / iade (giden)',
  Charge: 'Borç kaydı',
};

export const PAYMENT_METHODS = ['Havale/EFT', 'Nakit', 'Kredi kartı', 'Çek', 'Senet'] as const;

export interface CustomerBalance {
  customerId: string;
  companyName: string;
  isActive: boolean;
  /** Kesilen faturaların ödenecek tutarı (tevkifat düşülmüş). */
  invoiced: number;
  invoiceCount: number;
  /** Faturasız borç kayıtları (devir vb.). */
  charged: number;
  /** Müşteriden gelen ödemeler. */
  collected: number;
  /** Müşteriye giden ödemeler (iade). */
  refunded: number;
  /** Pozitif: müşterinin borcu; negatif: müşterinin alacağı. */
  balance: number;
  lastMovementDate: string | null;
}

export interface BalanceTotals {
  invoiced: number;
  charged: number;
  collected: number;
  refunded: number;
  balance: number;
  customersWithBalance: number;
}

export interface BalanceOverview {
  totals: BalanceTotals;
  items: CustomerBalance[];
}

export interface LedgerEntry {
  kind: LedgerKind;
  id: string;
  date: string;
  title: string;
  description: string | null;
  debit: number;
  credit: number;
  /** Bu satırdan sonraki bakiye. */
  balance: number;
  invoiceId: string | null;
  transactionId: string | null;
  method: string | null;
  createdAt: string;
}

export interface CustomerLedger {
  balance: CustomerBalance;
  entries: LedgerEntry[];
}

export interface TransactionInput {
  type: TransactionType;
  amount: number;
  date: string;
  method?: string | null;
  description?: string | null;
}

/** Bakiye değişince açık ekranlar tazelenir (tahsilat eklendi, fatura kesildi vb.). */
const listeners = new Set<() => void>();
export function onAccountsChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function notifyAccountsChanged() {
  listeners.forEach((l) => l());
}

export const accountService = {
  balances: (openOnly = false) => http<BalanceOverview>('/api/customers/balances', { query: { openOnly } }),
  ledger: (customerId: string) => http<CustomerLedger>(`/api/customers/${customerId}/ledger`),
  async addTransaction(customerId: string, input: TransactionInput) {
    await http<unknown>(`/api/customers/${customerId}/transactions`, { method: 'POST', json: input });
    notifyAccountsChanged();
  },
  async updateTransaction(customerId: string, id: string, input: TransactionInput) {
    await http<unknown>(`/api/customers/${customerId}/transactions/${id}`, { method: 'PUT', json: input });
    notifyAccountsChanged();
  },
  async deleteTransaction(customerId: string, id: string) {
    await http<void>(`/api/customers/${customerId}/transactions/${id}`, { method: 'DELETE' });
    notifyAccountsChanged();
  },
};
