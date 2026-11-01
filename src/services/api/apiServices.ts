import type {
  AuthService,
  CustomerService,
  DashboardService,
  EArchiveGateway,
  InvoiceMailer,
  InvoiceService,
  JobService,
  LocationRepository,
  UserService,
  VehicleService,
} from '../contracts';
import { ServiceError } from '../errors';
import { savePdf } from '../files';
import { http, httpAll, httpBinary } from '../http';
import type { InvoiceFilter, JobStatus, LocationFix, Session, User, WithholdingType } from '@/types';
import { isEmail } from '@/utils/validation';
import {
  customerAddressFromApi,
  customerFromApi,
  customerToApi,
  invoiceFromApiDetail,
  invoiceFromApiList,
  jobDetailFromApi,
  jobFromApi,
  jobToApi,
  locationFromApi,
  monthRevenueFromApi,
  stopTypeToApi,
  credentialFromApi,
  userFromApi,
  userToApi,
  vehicleFromApi,
  vehicleToApi,
  type ApiActiveJobLocation,
  type ApiAuthResponse,
  type ApiCustomer,
  type ApiCustomerAddress,
  type ApiInvoiceDetail,
  type ApiInvoiceListItem,
  type ApiJob,
  type ApiJobDetail,
  type ApiMonthRevenue,
  type ApiUser,
  type ApiUserCredential,
  type ApiVehicle,
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
  create: async (input) => credentialFromApi(await http<ApiUserCredential>('/api/users', { method: 'POST', json: userToApi(input) })),
  update: async (id, input) => userFromApi(await http<ApiUser>(`/api/users/${id}`, { method: 'PUT', json: { ...userToApi(input), isActive: input.isActive } })),
  resetPassword: async (id) => credentialFromApi(await http<ApiUserCredential>(`/api/users/${id}/reset-password`, { method: 'POST', json: {} })),
  listVehicles: () => (isAdmin() ? apiVehicleService.list() : apiVehicleService.listMine()),
};

export const apiVehicleService: VehicleService = {
  list: async () => (await httpAll<ApiVehicle>('/api/vehicles')).map(vehicleFromApi),
  listMine: async () => (await http<ApiVehicle[]>('/api/vehicles/my')).map(vehicleFromApi),
  create: async (input) => vehicleFromApi(await http<ApiVehicle>('/api/vehicles', { method: 'POST', json: vehicleToApi(input) })),
  update: async (id, input) => vehicleFromApi(await http<ApiVehicle>(`/api/vehicles/${id}`, { method: 'PUT', json: vehicleToApi(input) })),
  assign: async (id, driverId) => vehicleFromApi(await http<ApiVehicle>(`/api/vehicles/${id}/assign`, { method: 'POST', json: { driverId } })),
  unassign: async (id) => vehicleFromApi(await http<ApiVehicle>(`/api/vehicles/${id}/unassign`, { method: 'POST', json: {} })),
};

export const apiDashboardService: DashboardService = {
  revenue: async (year, month) => monthRevenueFromApi(await http<ApiMonthRevenue>('/api/dashboard/revenue', { query: { year, month } })),
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
  async addresses(customerId, type) {
    const list = await http<ApiCustomerAddress[]>(`/api/customers/${customerId}/addresses`, {
      query: { stopType: type ? stopTypeToApi(type) : undefined, limit: 50 },
    });
    return list.map(customerAddressFromApi);
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

const BILLING_TO_API = { not_invoiced: 'NotInvoiced', in_draft: 'InDraft', invoiced: 'Invoiced' } as const;

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
      billingStatus: filter.billingStatus ? BILLING_TO_API[filter.billingStatus] : undefined,
    });
    return jobs.map((j) => jobFromApi(j));
  },

  get: async (id) => jobDetailFromApi(await http<ApiJobDetail>(`/api/jobs/${id}`)),

  async create(input) {
    const detail = await http<ApiJobDetail>('/api/jobs', {
      method: 'POST',
      json: { ...jobToApi(input), assignedDriverId: input.driverId || null, assignedVehicleId: (input.driverId && input.vehicleId) || null },
    });
    return jobDetailFromApi(detail);
  },

  async update(id, input) {
    let job = jobDetailFromApi(await http<ApiJobDetail>(`/api/jobs/${id}`, { method: 'PUT', json: jobToApi(input) }));
    // Güncelleme isteği şoförü/aracı değiştirmez; değiştiyse atama ayrı yapılır.
    const nextDriver = input.driverId || undefined;
    const nextVehicle = (nextDriver && input.vehicleId) || undefined;
    const changed = nextDriver !== job.driverId || nextVehicle !== job.vehicleId;
    if (changed && job.status !== 'completed' && job.status !== 'cancelled') {
      job = await jobAction(id, 'assign', {
        driverId: nextDriver ?? null,
        vehicleId: nextVehicle ?? null,
        note: nextDriver !== job.driverId ? 'Şoför değiştirildi' : 'Araç değiştirildi',
      });
    }
    return job;
  },

  assign: (id, driverId, _actorId, vehicleId) => jobAction(id, 'assign', { driverId, vehicleId: (driverId && vehicleId) || null }),
  takeOver: (id, _actorId, vehicleId) => jobAction(id, 'claim', { vehicleId: vehicleId || null }),

  advance(id, next) {
    const action = ADVANCE_ACTION[next];
    if (!action) throw new ServiceError('conflict', 'Bu durum değişikliği desteklenmiyor.');
    return jobAction(id, action);
  },

  cancel: (id, _actorId, reason) => jobAction(id, 'cancel', { reason: reason ?? null }),
};

const INVOICE_STATUS_TO_API: Record<NonNullable<InvoiceFilter['status']>, string> = {
  draft: 'Draft',
  issued: 'Issued',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

export const apiInvoiceService: InvoiceService = {
  async list(filter = {}) {
    if (!isAdmin()) return [];
    const list = await httpAll<ApiInvoiceListItem>('/api/invoices', {
      customerId: filter.customerId,
      startDate: filter.dateFrom,
      endDate: filter.dateTo,
      status: filter.status ? INVOICE_STATUS_TO_API[filter.status] : undefined,
    });
    return list.map(invoiceFromApiList);
  },

  get: async (id) => invoiceFromApiDetail(await http<ApiInvoiceDetail>(`/api/invoices/${id}`)),

  /**
   * Taslak (resmi olmayan) fatura oluşturur. Tutar sunucuda işin fiyatından hesaplanır;
   * resmi fatura yalnızca e-Arşiv sağlayıcısı üzerinden kesilir.
   */
  async createDemo(input) {
    const detail = await http<ApiInvoiceDetail>('/api/invoices', {
      method: 'POST',
      // Tutar sunucuda işlerin fiyatından hesaplanır; aynı müşteriye ait birden fazla iş tek faturada birleşir.
      json: {
        jobIds: input.jobIds?.length ? input.jobIds : input.jobId ? [input.jobId] : [],
        invoiceDate: input.issueDate,
        vatRate: input.vatRate,
        notes: input.description.trim() || null,
        withholdingCode: input.withholdingCode ?? null,
        noWithholding: !input.withholdingCode,
        iban: input.iban?.trim() || null,
      },
    });
    return invoiceFromApiDetail(detail);
  },

  cancel: async (id) => invoiceFromApiDetail(await http<ApiInvoiceDetail>(`/api/invoices/${id}/cancel`, { method: 'POST', json: {} })),

  async downloadPdf(id, kind) {
    const path = kind === 'invoice' ? `/api/invoices/${id}/pdf` : `/api/invoices/${id}/job-report/pdf`;
    const bytes = await httpBinary(path);
    return savePdf(bytes, kind === 'invoice' ? `Fatura_${id}.pdf` : `Is_Dokumu_${id}.pdf`);
  },

  withholdingTypes: () => http<WithholdingType[]>('/api/invoices/withholding-types'),
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
  async sendSignSms(invoiceId) {
    const r = await http<{ operationId: string; maskedPhone: string | null }>(`/api/invoices/${invoiceId}/earchive/sms`, { method: 'POST' });
    return { operationId: r.operationId, maskedPhone: r.maskedPhone ?? undefined };
  },
  sign: async (invoiceId, operationId, code) =>
    invoiceFromApiDetail(await http<ApiInvoiceDetail>(`/api/invoices/${invoiceId}/earchive/sign`, { method: 'POST', json: { operationId, code } })),
  discardDraft: async (invoiceId) =>
    invoiceFromApiDetail(await http<ApiInvoiceDetail>(`/api/invoices/${invoiceId}/earchive/discard`, { method: 'POST' })),
};

export const apiInvoiceMailer: InvoiceMailer = {
  async send(invoiceId) {
    const inv = invoiceFromApiDetail(await http<ApiInvoiceDetail>(`/api/invoices/${invoiceId}/resend-email`, { method: 'POST' }));
    return { status: inv.email.status === 'sent' ? 'sent' : 'queued' };
  },
};

const nonNegative = (v: number | null) => (v != null && Number.isFinite(v) && v >= 0 ? v : null);

/** Cihazlar bilinmeyen değerler için -1 döndürebilir; API negatif değer kabul etmez. */
const toPoint = (fix: LocationFix) => ({
  latitude: fix.latitude,
  longitude: fix.longitude,
  accuracy: nonNegative(fix.accuracy),
  speed: nonNegative(fix.speed),
  heading: nonNegative(fix.heading) != null && fix.heading! <= 360 ? fix.heading : null,
  recordedAt: new Date(fix.timestamp).toISOString(),
});

export const apiLocationRepository: LocationRepository = {
  async publish(location) {
    await http('/api/locations/update', { method: 'POST', json: { jobId: location.jobId, ...toPoint(location.fix) } });
  },

  async listActive() {
    const list = await http<ApiActiveJobLocation[]>('/api/locations/active-jobs');
    return list.map(locationFromApi).filter((l) => l !== null);
  },

  async publishMine(_driverId: string, fixes: LocationFix[]) {
    const res = await http<{ jobIds: string[] }>('/api/locations/me', {
      method: 'POST',
      json: { points: fixes.map(toPoint) },
    });
    return res.jobIds ?? [];
  },

  // İş tamamlanınca/iptal edilince sunucu konumu zaten aktif listeden çıkarır.
  clear: async () => {},
};
