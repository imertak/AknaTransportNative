import { APP_CONFIG } from '@/constants/config';
import type { EArchiveGateway, InvoiceMailer, InvoiceService } from './contracts';
import { ServiceError } from './errors';
import { createId, sequenceNo } from '@/utils/id';
import { mockDb } from './mockDb';

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function calculateInvoiceTotals(subtotal: number, vatRate: number) {
  const vatAmount = round2((subtotal * vatRate) / 100);
  return { subtotal: round2(subtotal), vatAmount, total: round2(subtotal + vatAmount) };
}

export const mockInvoiceService: InvoiceService = {
  list: () => mockDb.read((db) => [...db.invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),

  async get(id) {
    const inv = await mockDb.read((db) => db.invoices.find((x) => x.id === id) ?? null);
    if (!inv) throw new ServiceError('not_found', 'Fatura bulunamadı.');
    return inv;
  },

  createDemo: (input) =>
    mockDb.write((db) => {
      const job = db.jobs.find((j) => j.id === input.jobId);
      if (!job) throw new ServiceError('not_found', 'İş kaydı bulunamadı.');
      if (job.status !== 'completed') throw new ServiceError('conflict', 'Yalnızca tamamlanan işler için fatura oluşturulabilir.');
      const active = job.invoiceId ? db.invoices.find((i) => i.id === job.invoiceId && i.status !== 'cancelled') : undefined;
      if (active) throw new ServiceError('conflict', `Bu iş için ${active.invoiceNo} numaralı fatura zaten mevcut.`);
      if (!(input.subtotal > 0)) throw new ServiceError('validation', 'Ara toplam sıfırdan büyük olmalı.');
      const customer = db.customers.find((c) => c.id === job.customerId)!;
      db.counters.invoice += 1;
      const invoice = {
        id: createId('inv'),
        invoiceNo: sequenceNo(APP_CONFIG.demoInvoicePrefix, Number(input.issueDate.slice(0, 4)), db.counters.invoice),
        mode: 'demo' as const,
        status: 'demo_created' as const,
        customerId: customer.id,
        customerName: customer.companyName,
        jobId: job.id,
        jobNo: job.jobNo,
        issueDate: input.issueDate,
        description: input.description.trim(),
        vatRate: input.vatRate,
        ...calculateInvoiceTotals(input.subtotal, input.vatRate),
        // Demo modunda e-posta gönderilmez; API aşamasında InvoiceMailer kuyruğa alacak.
        email: { to: customer.email, status: 'not_sent' as const },
        createdAt: new Date().toISOString(),
      };
      db.invoices.push(invoice);
      job.invoiceId = invoice.id;
      return invoice;
    }),

  cancel: (id) =>
    mockDb.write((db) => {
      const inv = db.invoices.find((x) => x.id === id);
      if (!inv) throw new ServiceError('not_found', 'Fatura bulunamadı.');
      if (inv.status === 'cancelled') throw new ServiceError('conflict', 'Fatura zaten iptal edilmiş.');
      inv.status = 'cancelled';
      const job = db.jobs.find((j) => j.invoiceId === id);
      if (job) job.invoiceId = undefined;
      return inv;
    }),
};

const notReady = () => {
  throw new ServiceError('not_implemented', 'e-Arşiv entegrasyonu API aşamasında etkinleştirilecek.');
};

/** e-Arşiv entegrasyonu bağlanana kadar tüm çağrılar açıkça reddedilir. */
export const pendingEArchiveGateway: EArchiveGateway = {
  issue: async () => notReady(),
  getStatus: async () => notReady(),
  cancel: async () => notReady(),
};

export const pendingInvoiceMailer: InvoiceMailer = {
  send: async () => {
    throw new ServiceError('not_implemented', 'E-posta gönderimi API aşamasında etkinleştirilecek.');
  },
};
