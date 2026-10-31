import type {
  Customer,
  CustomerInput,
  Invoice,
  InvoiceEmailStatus,
  InvoiceStatus,
  JobInput,
  JobStatus,
  JobStatusEvent,
  TransportJob,
  User,
  VehicleLocation,
  VehicleType,
} from '@/types';

/**
 * .NET API DTO'ları ile uygulama modelleri arasındaki dönüşümler.
 * API enum'ları PascalCase string ("OnTheWay"), uygulama snake_case ("on_the_way") kullanır.
 */

// ---- API DTO tipleri (yalnızca kullanılan alanlar) ----

export interface ApiUser {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: 'Admin' | 'User';
  isActive: boolean;
  mustChangePassword: boolean;
}

export interface ApiAuthResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: ApiUser;
}

export interface ApiCustomer {
  id: string;
  companyName: string;
  contactPerson: string | null;
  phoneNumber: string | null;
  email: string | null;
  taxOffice: string | null;
  taxNumber: string | null;
  address: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface ApiJob {
  id: string;
  jobNumber: string;
  customerId: string;
  customerName: string;
  createdByUserId: string;
  assignedDriverId: string | null;
  jobDate: string;
  storeName: string;
  vehicleType: string;
  pickupAddress: string;
  deliveryAddress: string;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  description: string;
  price: number;
  status: string;
  notes: string | null;
  cancellationReason: string | null;
  invoiceId: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ApiJobHistory {
  toStatus: string;
  changedByUserId: string;
  changedByUserName: string | null;
  changedAt: string;
  description: string | null;
}

export interface ApiJobDetail {
  job: ApiJob;
  statusHistory: ApiJobHistory[];
}

export interface ApiInvoiceListItem {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  subTotal: number;
  vatRate: number;
  vatAmount: number;
  grandTotal: number;
  status: 'Draft' | 'Pending' | 'Issued' | 'Failed' | 'Cancelled';
  isOfficial: boolean;
  eArchiveInvoiceNumber: string | null;
  createdAt: string;
  firstJobId: string | null;
  firstJobNumber: string | null;
  description: string | null;
  customerEmail: string | null;
}

export interface ApiInvoiceDetail extends Omit<ApiInvoiceListItem, 'firstJobId' | 'firstJobNumber' | 'description'> {
  notes: string | null;
  eArchiveReference: string | null;
  items: { jobId: string; jobNumber: string; description: string }[];
  email: { recipientEmail: string; status: 'Pending' | 'Sent' | 'Failed'; sentAt: string | null } | null;
}

export interface ApiActiveJobLocation {
  jobId: string;
  driverId: string | null;
  location: {
    jobId: string;
    driverId: string;
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
    heading: number | null;
    recordedAt: string;
  } | null;
}

// ---- Enum dönüşümleri ----

const toSnake = (v: string) => v.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const toPascal = (v: string) => v.replace(/(^|_)([a-z])/g, (_, __, c: string) => c.toUpperCase());

export const jobStatusFromApi = (v: string) => toSnake(v) as JobStatus;
export const vehicleTypeFromApi = (v: string) => toSnake(v) as VehicleType;
export const vehicleTypeToApi = (v: VehicleType) => toPascal(v);

// ---- Varlık dönüşümleri ----

export function userFromApi(u: ApiUser): User {
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phoneNumber ?? '',
    role: u.role === 'Admin' ? 'admin' : 'driver',
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword,
  };
}

export function customerFromApi(c: ApiCustomer): Customer {
  return {
    id: c.id,
    companyName: c.companyName,
    contactName: c.contactPerson ?? '',
    phone: c.phoneNumber ?? '',
    email: c.email ?? '',
    taxOffice: c.taxOffice ?? '',
    taxNumber: c.taxNumber ?? '',
    billingAddress: c.address ?? '',
    notes: c.description ?? '',
    createdAt: c.createdAt,
    updatedAt: c.updatedAt ?? c.createdAt,
  };
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);

export function customerToApi(c: CustomerInput, isActive = true) {
  return {
    companyName: c.companyName.trim(),
    contactPerson: orNull(c.contactName),
    phoneNumber: orNull(c.phone),
    email: orNull(c.email),
    taxOffice: orNull(c.taxOffice),
    taxNumber: orNull(c.taxNumber),
    address: orNull(c.billingAddress),
    description: orNull(c.notes),
    isActive,
  };
}

const point = (lat: number | null, lng: number | null) => (lat != null && lng != null ? { latitude: lat, longitude: lng } : undefined);

export function historyFromApi(h: ApiJobHistory): JobStatusEvent {
  return {
    status: jobStatusFromApi(h.toStatus),
    at: h.changedAt,
    byUserId: h.changedByUserId,
    byUserName: h.changedByUserName ?? undefined,
    note: h.description ?? undefined,
  };
}

export function jobFromApi(j: ApiJob, history: ApiJobHistory[] = []): TransportJob {
  return {
    id: j.id,
    jobNo: j.jobNumber,
    customerId: j.customerId,
    customerName: j.customerName,
    date: j.jobDate,
    storeName: j.storeName,
    vehicleType: vehicleTypeFromApi(j.vehicleType),
    pickupAddress: j.pickupAddress,
    deliveryAddress: j.deliveryAddress,
    description: j.description,
    price: j.price,
    driverId: j.assignedDriverId ?? undefined,
    notes: j.notes ?? '',
    status: jobStatusFromApi(j.status),
    // Liste yanıtında geçmiş yoktur; iş detayı açıldığında doldurulur.
    statusHistory: history.map(historyFromApi),
    pickupPoint: point(j.pickupLatitude, j.pickupLongitude),
    deliveryPoint: point(j.deliveryLatitude, j.deliveryLongitude),
    invoiceId: j.invoiceId ?? undefined,
    createdBy: j.createdByUserId,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt ?? j.createdAt,
  };
}

export const jobDetailFromApi = (d: ApiJobDetail) => jobFromApi(d.job, d.statusHistory);

export function jobToApi(input: JobInput) {
  return {
    customerId: input.customerId,
    jobDate: input.date,
    storeName: input.storeName.trim(),
    vehicleType: vehicleTypeToApi(input.vehicleType),
    pickupAddress: input.pickupAddress.trim(),
    deliveryAddress: input.deliveryAddress.trim(),
    description: input.description.trim(),
    price: input.price,
    notes: orNull(input.notes ?? ''),
  };
}

/**
 * Taslak ve hatalı faturalar resmi değildir (uygulamada "demo" modu). Gönderimde/kesilmiş
 * faturalar e-Arşiv modundadır. İptal edilen fatura, e-Arşiv numarası varsa e-Arşiv sayılır.
 */
function invoiceState(status: ApiInvoiceListItem['status'], eArchiveNo: string | null): { mode: Invoice['mode']; status: InvoiceStatus } {
  switch (status) {
    case 'Draft':
      return { mode: 'demo', status: 'demo_draft' };
    case 'Failed':
      return { mode: 'demo', status: 'earsiv_failed' };
    case 'Pending':
      return { mode: 'earsiv', status: 'earsiv_pending' };
    case 'Issued':
      return { mode: 'earsiv', status: 'earsiv_issued' };
    default:
      return { mode: eArchiveNo ? 'earsiv' : 'demo', status: 'cancelled' };
  }
}

const EMAIL_STATUS: Record<'Pending' | 'Sent' | 'Failed', InvoiceEmailStatus> = { Pending: 'queued', Sent: 'sent', Failed: 'failed' };

export function invoiceFromApiList(i: ApiInvoiceListItem): Invoice {
  return {
    id: i.id,
    invoiceNo: i.invoiceNumber,
    ...invoiceState(i.status, i.eArchiveInvoiceNumber),
    customerId: i.customerId,
    customerName: i.customerName,
    jobId: i.firstJobId ?? '',
    jobNo: i.firstJobNumber ?? '',
    issueDate: i.invoiceDate,
    description: i.description ?? '',
    subtotal: i.subTotal,
    vatRate: i.vatRate,
    vatAmount: i.vatAmount,
    total: i.grandTotal,
    // Liste yanıtında e-posta durumu yoktur; detay açıldığında güncellenir.
    email: { to: i.customerEmail ?? '', status: i.status === 'Issued' ? 'queued' : 'not_sent' },
    externalId: i.eArchiveInvoiceNumber ?? undefined,
    createdAt: i.createdAt,
  };
}

export function invoiceFromApiDetail(i: ApiInvoiceDetail): Invoice {
  const first = i.items[0];
  return {
    id: i.id,
    invoiceNo: i.invoiceNumber,
    ...invoiceState(i.status, i.eArchiveInvoiceNumber),
    customerId: i.customerId,
    customerName: i.customerName,
    jobId: first?.jobId ?? '',
    jobNo: first?.jobNumber ?? '',
    issueDate: i.invoiceDate,
    description: i.notes ?? first?.description ?? '',
    subtotal: i.subTotal,
    vatRate: i.vatRate,
    vatAmount: i.vatAmount,
    total: i.grandTotal,
    email: i.email
      ? { to: i.email.recipientEmail, status: EMAIL_STATUS[i.email.status], sentAt: i.email.sentAt ?? undefined }
      : { to: i.customerEmail ?? '', status: 'not_sent' },
    externalId: i.eArchiveInvoiceNumber ?? undefined,
    ettn: i.eArchiveReference ?? undefined,
    createdAt: i.createdAt,
  };
}

export function locationFromApi(l: ApiActiveJobLocation): VehicleLocation | null {
  if (!l.location) return null;
  const p = l.location;
  return {
    jobId: l.jobId,
    driverId: p.driverId,
    fix: {
      latitude: p.latitude,
      longitude: p.longitude,
      accuracy: p.accuracy,
      speed: p.speed,
      heading: p.heading,
      timestamp: Date.parse(p.recordedAt),
    },
  };
}
