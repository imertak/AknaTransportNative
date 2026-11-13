import type { ConvertOfferResult, OfferDetail, OfferFilter, OfferInput, OfferListItem, OfferStats } from '@/types/offers';

import type { ListPage } from './contracts';
import { savePdf } from './files';
import { http, httpBinary, type Paged } from './http';

const BASE = '/api/transport-offers';

function query(filter: OfferFilter) {
  return {
    search: filter.search?.trim(),
    status: filter.status,
    customerId: filter.customerId,
    startDate: filter.startDate,
    endDate: filter.endDate,
  };
}

/**
 * Nakliye teklifleri (yalnızca yönetici). Durum geçişleri, tutar hesabı ve numara sunucuda yapılır;
 * istemci yalnızca isteği gönderir ve dönen teklifi gösterir.
 */
export const offerService = {
  async listPage(filter: OfferFilter, page: number, pageSize: number): Promise<ListPage<OfferListItem>> {
    const res = await http<Paged<OfferListItem>>(BASE, { query: { ...query(filter), pageNumber: page, pageSize } });
    return { items: res.items, totalCount: res.totalCount };
  },
  /** Durum sayıları; durum filtresi uygulanmaz (her sekmenin sayısı görünsün). */
  stats: (filter: Omit<OfferFilter, 'status'>) => http<OfferStats>(`${BASE}/stats`, { query: query(filter) }),
  get: (id: string) => http<OfferDetail>(`${BASE}/${id}`),
  create: (input: OfferInput) => http<OfferDetail>(BASE, { method: 'POST', json: input }),
  update: (id: string, input: OfferInput) => http<OfferDetail>(`${BASE}/${id}`, { method: 'PUT', json: input }),
  copy: (id: string) => http<OfferDetail>(`${BASE}/${id}/copy`, { method: 'POST', json: {} }),
  send: (id: string) => http<OfferDetail>(`${BASE}/${id}/send`, { method: 'POST', json: {} }),
  accept: (id: string) => http<OfferDetail>(`${BASE}/${id}/accept`, { method: 'POST', json: {} }),
  reject: (id: string, reason?: string) => http<OfferDetail>(`${BASE}/${id}/reject`, { method: 'POST', json: { reason: reason?.trim() || null } }),
  cancel: (id: string, reason?: string) => http<OfferDetail>(`${BASE}/${id}/cancel`, { method: 'POST', json: { reason: reason?.trim() || null } }),
  async remove(id: string) {
    await http(`${BASE}/${id}`, { method: 'DELETE' });
  },
  convertToJob: (id: string) => http<ConvertOfferResult>(`${BASE}/${id}/convert-to-job`, { method: 'POST', json: {} }),
  /** Sunucunun ürettiği PDF'i indirip cihazda `AKNA_Teklif_<no>.pdf` adıyla saklar; dosya URI'sini döndürür. */
  async downloadPdf(offer: Pick<OfferDetail, 'id' | 'pdfFileName' | 'offerNumber'>): Promise<string> {
    const bytes = await httpBinary(`${BASE}/${offer.id}/pdf`);
    return savePdf(bytes, offer.pdfFileName || `AKNA_Teklif_${offer.offerNumber}.pdf`);
  },
};
