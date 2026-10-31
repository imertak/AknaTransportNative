import { APP_CONFIG } from '@/constants/config';
import type { EArchiveGateway, InvoiceMailer, InvoiceService } from './contracts';
import { ServiceError } from './errors';
import { createId, sequenceNo } from '@/utils/id';
import { mockDb } from './mockDb';
import type { Invoice, InvoiceFilter } from '@/types';
import { composeJobText } from '@/utils/stops';
import { amountInWords, calculateWithholding, DEFAULT_WITHHOLDING_TYPES, formatIban, isValidIban } from '@/utils/invoiceText';

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

export const mockInvoiceService: InvoiceService = {
  list: (filter = {}) =>
    mockDb.read((db) =>
      db.invoices
        .filter((i) => matchesInvoiceFilter(i, filter))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ),

  async get(id) {
    const inv = await mockDb.read((db) => db.invoices.find((x) => x.id === id) ?? null);
    if (!inv) throw new ServiceError('not_found', 'Fatura bulunamadı.');
    return inv;
  },

  createDemo: (input) =>
    mockDb.write((db) => {
      const jobIds = input.jobIds?.length ? input.jobIds : input.jobId ? [input.jobId] : [];
      if (!jobIds.length) throw new ServiceError('validation', 'En az bir iş seçilmelidir.');
      const jobList = jobIds.map(jid => {
        const job = db.jobs.find((j) => j.id === jid);
        if (!job) throw new ServiceError('not_found', `İş kaydı bulunamadı: ${jid}`);
        if (job.status !== 'completed') throw new ServiceError('conflict', `Yalnızca tamamlanan işler için fatura oluşturulabilir. (${job.jobNo})`);
        const active = job.invoiceId ? db.invoices.find((i) => i.id === job.invoiceId && i.status !== 'cancelled') : undefined;
        if (active) throw new ServiceError('conflict', `${job.jobNo} için ${active.invoiceNo} numaralı fatura zaten mevcut.`);
        return job;
      });
      if (new Set(jobList.map((j) => j.customerId)).size > 1) {
        throw new ServiceError('validation', 'Tek faturada yalnızca aynı müşteriye ait işler birleştirilebilir.');
      }
      if (!(input.subtotal > 0)) throw new ServiceError('validation', 'Ara toplam sıfırdan büyük olmalı.');
      const firstJob = jobList[0]!;
      const customer = db.customers.find((c) => c.id === firstJob.customerId)!;
      const withholding = input.withholdingCode ? DEFAULT_WITHHOLDING_TYPES.find((w) => w.code === input.withholdingCode) ?? null : null;
      if (input.withholdingCode && !withholding) throw new ServiceError('validation', 'Geçersiz tevkifat kodu.');
      if (input.iban && !isValidIban(input.iban)) throw new ServiceError('validation', 'IBAN geçersiz.');
      const totals = calculateInvoiceTotals(input.subtotal, input.vatRate);
      const wh = calculateWithholding(totals.vatAmount, totals.total, withholding);
      db.counters.invoice += 1;
      const invoice = {
        id: createId('inv'),
        invoiceNo: sequenceNo(APP_CONFIG.demoInvoicePrefix, Number(input.issueDate.slice(0, 4)), db.counters.invoice),
        mode: 'demo' as const,
        status: 'demo_created' as const,
        customerId: customer.id,
        customerName: customer.companyName,
        jobId: firstJob.id,
        jobNo: firstJob.jobNo,
        jobIds: jobIds,
        jobNos: jobList.map(j => j.jobNo),
        jobCount: jobList.length,
        items: jobList.map((j) => ({
          jobId: j.id,
          jobNo: j.jobNo,
          jobDate: j.date,
          storeName: j.storeName,
          description: composeJobText(j.routeDescription, j.description),
          amount: j.price,
        })),
        issueDate: input.issueDate,
        description: input.description.trim(),
        vatRate: input.vatRate,
        ...totals,
        withholdingCode: withholding?.code,
        withholdingName: withholding?.name,
        withholdingRate: withholding?.rate ?? 0,
        ...wh,
        amountInWords: amountInWords(wh.payableAmount),
        iban: input.iban ? formatIban(input.iban) : undefined,
        email: { to: customer.email, status: 'not_sent' as const },
        createdAt: new Date().toISOString(),
      };
      db.invoices.push(invoice);
      jobList.forEach((j) => {
        j.invoiceId = invoice.id;
        j.billingStatus = 'in_draft';
      });
      return invoice;
    }),

  cancel: (id) =>
    mockDb.write((db) => {
      const inv = db.invoices.find((x) => x.id === id);
      if (!inv) throw new ServiceError('not_found', 'Fatura bulunamadı.');
      if (inv.status === 'cancelled') throw new ServiceError('conflict', 'Fatura zaten iptal edilmiş.');
      inv.status = 'cancelled';
      const relatedJobIds = inv.jobIds?.length ? inv.jobIds : [inv.jobId];
      db.jobs.forEach((j) => {
        if (relatedJobIds.includes(j.id)) {
          j.invoiceId = undefined;
          j.billingStatus = 'not_invoiced';
        }
      });
      return inv;
    }),

  // Demo modda sunucu PDF'i yoktur; PDF cihazda üretilir.
  downloadPdf: async () => null,

  withholdingTypes: async () => DEFAULT_WITHHOLDING_TYPES,
};

const notReady = () => {
  throw new ServiceError('not_implemented', 'e-Arşiv entegrasyonu API aşamasında etkinleştirilecek.');
};

/** e-Arşiv entegrasyonu bağlanana kadar tüm çağrılar açıkça reddedilir. */
export const pendingEArchiveGateway: EArchiveGateway = {
  issue: async () => notReady(),
  getStatus: async () => notReady(),
  cancel: async () => notReady(),
  sendSignSms: async () => notReady(),
  sign: async () => notReady(),
  discardDraft: async () => notReady(),
};

export const pendingInvoiceMailer: InvoiceMailer = {
  send: async () => {
    throw new ServiceError('not_implemented', 'E-posta gönderimi API aşamasında etkinleştirilecek.');
  },
};
