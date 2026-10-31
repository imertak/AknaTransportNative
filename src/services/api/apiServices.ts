import type {
  AuthService,
  CustomerService,
  EArchiveGateway,
  InvoiceMailer,
  InvoiceService,
  JobService,
  LocationRepository,
  UserService,
} from '../contracts';
import { ServiceError } from '../errors';
import { http, httpAll } from '../http';
import type { JobStatus, Session, User } from '@/types';
import { isEmail } from '@/utils/validation';
import {
  customerFromApi,
  customerToApi,
  invoiceFromApiDetail,
  invoiceFromApiList,
  jobDetailFromApi,
  jobFromApi,
  jobToApi,
  locationFromApi,
  userFromApi,
  type ApiActiveJobLocation,
  type ApiAuthResponse,
  type ApiCustomer,
  type ApiInvoiceDetail,
  type ApiInvoiceListItem,
  type ApiJob,
  type ApiJobDetail,
  type ApiUser,
} from './mappers';

/**
 * Oturum açmış kullanıcı. Şoför hesapları yönetici uç noktalarına (kullanıcılar,
 * müşteriler, faturalar) erişemediği için bu listeler şoförde istek atılmadan boş döner.
 */
let currentUser: User | null = null;
const isAdmin = () => currentUser?.role === 'admin';

function toSession(res: ApiAuthResponse): { session: Session; user: User } {
  const user = userFromApi(res.user);
  currentUser = user;
  return {
    user,
    session: {
      token: res.accessToken,
      refreshToken: res.refreshToken,
      expiresAt: res.accessTokenExpiresAt,
      userId: user.id,
      issuedAt: new Date().toISOString(),
    },
  };
}

export const apiAuthService: AuthService = {
  async login(email, password) {
    const res = await http<ApiAuthResponse>('/api/auth/login', {
      method: 'POST',
      anonymous: true,
      json: { email: email.trim(), password },
    });
    const result = toSession(res);
    if (!result.user.isActive) throw new ServiceError('forbidden', 'Hesabınız pasif durumda. Yöneticinizle iletişime geçin.');
    return result;
  },

  async restore() {
    try {
      const user = userFromApi(await http<ApiUser>('/api/auth/me'));
      currentUser = user;
      return user.isActive ? user : null;
    } catch (e) {
      // Geçersiz/iptal edilmiş oturum: girişe yönlendir. Ağ hatasında da oturum açılamaz.
      if (e instanceof ServiceError && e.code === 'network') throw e;
      return null;
    }
  },

  async logout(session) {
    currentUser = null;
    if (!session.refreshToken) return;
    await http('/api/auth/logout', { method: 'POST', json: { refreshToken: session.refreshToken } }).catch(() => {});
  },

  async requestPasswordReset(email) {
    if (!isEmail(email)) throw new ServiceError('validation', 'Geçerli bir e-posta adresi girin.');
    await http('/api/auth/forgot-password', { method: 'POST', anonymous: true, json: { email: email.trim() } });
  },

  async resetPassword(email, code, newPassword) {
    await http('/api/auth/reset-password', {
      method: 'POST',
      anonymous: true,
      json: { email: email.trim(), token: code.trim(), newPassword },
    });
  },

  async refresh(session) {
    if (!session.refreshToken) throw new ServiceError('session_expired', 'Oturumunuzun süresi doldu.');
    const res = await http<ApiAuthResponse>('/api/auth/refresh-token', {
      method: 'POST',
      anonymous: true,
      json: { refreshToken: session.refreshToken },
    });
    return toSession(res).session;
  },

  async changePassword(currentPassword, newPassword) {
    const res = await http<ApiAuthResponse>('/api/auth/change-password', {
      method: 'POST',
      json: { currentPassword, newPassword },
    });
    return toSession(res);
  },
};

export const apiUserService: UserService = {
  async list() {
    if (!isAdmin()) return currentUser ? [currentUser] : [];
    return (await httpAll<ApiUser>('/api/users')).map(userFromApi);
  },
  // Araç/plaka kaydı API'de henüz yok.
  listVehicles: async () => [],
};

export const apiCustomerService: CustomerService = {
  async list() {
    if (!isAdmin()) return [];
    const list = (await httpAll<ApiCustomer>('/api/customers')).map(customerFromApi);
    return list.sort((a, b) => a.companyName.localeCompare(b.companyName, 'tr'));
  },
  get: async (id) => customerFromApi(await http<ApiCustomer>(`/api/customers/${id}`)),
  create: async (input) => customerFromApi(await http<ApiCustomer>('/api/customers', { method: 'POST', json: customerToApi(input) })),
  update: async (id, input) => customerFromApi(await http<ApiCustomer>(`/api/customers/${id}`, { method: 'PUT', json: customerToApi(input) })),
  async remove(id) {
    // İşi olan müşteri silinmez, pasife alınır; her iki durumda da listeden kalkar.
    await http(`/api/customers/${id}`, { method: 'DELETE' });
  },
};

/** Şoför akışındaki hedef durum → API eylemi. */
const ADVANCE_ACTION: Partial<Record<JobStatus, string>> = {
  accepted: 'accept',
  on_the_way: 'start',
  loading: 'start-loading',
  delivering: 'start-delivery',
  completed: 'complete',
};

const jobAction = async (id: string, action: string, json: unknown = {}) =>
  jobDetailFromApi(await http<ApiJobDetail>(`/api/jobs/${id}/${action}`, { method: 'PATCH', json }));

export const apiJobService: JobService = {
  async list(filter = {}) {
    const jobs = await httpAll<ApiJob>('/api/jobs', {
      search: filter.query,
      status: filter.statuses?.map((s) => s.replace(/(^|_)([a-z])/g, (_, __, c: string) => c.toUpperCase())),
      customerId: filter.customerId,
      driverId: filter.driverId,
      startDate: filter.dateFrom,
      endDate: filter.dateTo,
    });
    return jobs.map((j) => jobFromApi(j));
  },

  get: async (id) => jobDetailFromApi(await http<ApiJobDetail>(`/api/jobs/${id}`)),

  async create(input) {
    const detail = await http<ApiJobDetail>('/api/jobs', {
      method: 'POST',
      json: { ...jobToApi(input), assignedDriverId: input.driverId || null },
    });
    return jobDetailFromApi(detail);
  },

  async update(id, input) {
    let job = jobDetailFromApi(await http<ApiJobDetail>(`/api/jobs/${id}`, { method: 'PUT', json: jobToApi(input) }));
    // Güncelleme isteği şoförü değiştirmez; değiştiyse atama ayrı yapılır.
    const nextDriver = input.driverId || undefined;
    if (nextDriver !== job.driverId && job.status !== 'completed' && job.status !== 'cancelled') {
      job = await jobAction(id, 'assign', { driverId: nextDriver ?? null, note: 'Şoför değiştirildi' });
    }
    return job;
  },

  assign: (id, driverId) => jobAction(id, 'assign', { driverId }),
  takeOver: (id) => jobAction(id, 'claim'),

  advance(id, next) {
    const action = ADVANCE_ACTION[next];
    if (!action) throw new ServiceError('conflict', 'Bu durum değişikliği desteklenmiyor.');
    return jobAction(id, action);
  },

  cancel: (id, _actorId, reason) => jobAction(id, 'cancel', { reason: reason ?? null }),
};

export const apiInvoiceService: InvoiceService = {
  async list() {
    if (!isAdmin()) return [];
    return (await httpAll<ApiInvoiceListItem>('/api/invoices')).map(invoiceFromApiList);
  },

  get: async (id) => invoiceFromApiDetail(await http<ApiInvoiceDetail>(`/api/invoices/${id}`)),

  /**
   * Taslak (resmi olmayan) fatura oluşturur. Tutar sunucuda işin fiyatından hesaplanır;
   * resmi fatura yalnızca e-Arşiv sağlayıcısı üzerinden kesilir.
   */
  async createDemo(input) {
    const detail = await http<ApiInvoiceDetail>('/api/invoices', {
      method: 'POST',
      json: { jobIds: [input.jobId], invoiceDate: input.issueDate, vatRate: input.vatRate, notes: input.description.trim() || null },
    });
    return invoiceFromApiDetail(detail);
  },

  cancel: async (id) => invoiceFromApiDetail(await http<ApiInvoiceDetail>(`/api/invoices/${id}/cancel`, { method: 'POST', json: {} })),
};

export const apiEArchiveGateway: EArchiveGateway = {
  async issue(invoiceId) {
    // Sağlayıcı yapılandırılmamışsa API 503 döner ve fatura taslak kalır.
    const inv = invoiceFromApiDetail(await http<ApiInvoiceDetail>(`/api/invoices/${invoiceId}/issue`, { method: 'POST' }));
    return {
      ettn: inv.ettn ?? '',
      externalId: inv.externalId ?? '',
      status: inv.status === 'earsiv_issued' ? 'earsiv_issued' : 'earsiv_pending',
    };
  },
  getStatus: async (invoiceId) => (await apiInvoiceService.get(invoiceId)).status,
  async cancel(invoiceId, reason) {
    await http(`/api/invoices/${invoiceId}/cancel`, { method: 'POST', json: { reason } });
  },
};

export const apiInvoiceMailer: InvoiceMailer = {
  async send(invoiceId) {
    const inv = invoiceFromApiDetail(await http<ApiInvoiceDetail>(`/api/invoices/${invoiceId}/resend-email`, { method: 'POST' }));
    return { status: inv.email.status === 'sent' ? 'sent' : 'queued' };
  },
};

const nonNegative = (v: number | null) => (v != null && Number.isFinite(v) && v >= 0 ? v : null);

export const apiLocationRepository: LocationRepository = {
  async publish(location) {
    const { fix } = location;
    await http('/api/locations/update', {
      method: 'POST',
      json: {
        jobId: location.jobId,
        latitude: fix.latitude,
        longitude: fix.longitude,
        // Cihazlar bilinmeyen değerler için -1 döndürebilir; API negatif değer kabul etmez.
        accuracy: nonNegative(fix.accuracy),
        speed: nonNegative(fix.speed),
        heading: nonNegative(fix.heading) != null && fix.heading! <= 360 ? fix.heading : null,
        recordedAt: new Date(fix.timestamp).toISOString(),
      },
    });
  },

  async listActive() {
    const list = await http<ApiActiveJobLocation[]>('/api/locations/active-jobs');
    return list.map(locationFromApi).filter((l) => l !== null);
  },

  // İş tamamlanınca/iptal edilince sunucu konumu zaten aktif listeden çıkarır.
  clear: async () => {},
};
