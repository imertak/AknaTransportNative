import type {
  Customer,
  CustomerAddress,
  CustomerInput,
  Invoice,
  InvoiceEmailStatus,
  InvoiceStatus,
  JobBillingStatus,
  JobInput,
  JobStatus,
  JobStop,
  MonthRevenue,
  StopType,
  JobStatusEvent,
  TransportJob,
  User,
  Vehicle,
  VehicleInput,
  VehicleLocation,
  VehicleType,
} from '@/types';
import { buildRouteDescription, orderStops, toStops } from '@/utils/stops';

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
  routeDescription: string;
  stops: ApiJobStop[];
  assignedVehicleId: string | null;
  assignedVehiclePlate: string | null;
  billingStatus: 'NotInvoiced' | 'InDraft' | 'Invoiced';
}

export interface ApiJobStop {
  id: string;
  stopType: 'Pickup' | 'Delivery';
  sequence: number;
  address: string;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
}

export interface ApiVehicle {
  id: string;
  plateNumber: string;
  brand: string | null;
  model: string | null;
  vehicleType: string;
  isActive: boolean;
  description: string | null;
  driverId: string | null;
  driverName: string | null;
  assignedAt: string | null;
}

export interface ApiCustomerAddress {
  stopType: 'Pickup' | 'Delivery';
  address: string;
  latitude: number | null;
  longitude: number | null;
  useCount: number;
  lastUsedAt: string;
}

export interface ApiMonthRevenue {
  year: number;
  month: number;
  revenue: number;
  completedJobs: number;
  currency: string;
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
  jobCount: number;
  withholdingCode: string | null;
  withholdingAmount: number;
  payableAmount: number;
}

export interface ApiInvoiceDetail extends Omit<ApiInvoiceListItem, 'firstJobId' | 'firstJobNumber' | 'description' | 'jobCount'> {
  notes: string | null;
  eArchiveReference: string | null;
  lastError: string | null;
  items: { jobId: string; jobNumber: string; jobDate: string; storeName: string; description: string; lineTotal: number }[];
  email: { recipientEmail: string; status: 'Pending' | 'Sent' | 'Failed'; sentAt: string | null } | null;
  withholdingName: string | null;
  withholdingRate: number;
  amountInWords: string;
  iban: string | null;
  bankName: string | null;
  requiresSmsSignature: boolean;
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
export const stopTypeFromApi = (v: ApiJobStop['stopType']): StopType => (v === 'Pickup' ? 'pickup' : 'delivery');
export const stopTypeToApi = (v: StopType): ApiJobStop['stopType'] => (v === 'pickup' ? 'Pickup' : 'Delivery');
export const billingStatusFromApi = (v: ApiJob['billingStatus'] | undefined): JobBillingStatus =>
  v === 'Invoiced' ? 'invoiced' : v === 'InDraft' ? 'in_draft' : 'not_invoiced';

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

function stopsFromApi(j: ApiJob): JobStop[] {
  if (j.stops?.length) {
    return orderStops(
      j.stops.map((x) => ({
        id: x.id,
        type: stopTypeFromApi(x.stopType),
        sequence: x.sequence,
        address: x.address,
        point: point(x.latitude, x.longitude),
        description: x.description ?? undefined,
      })),
    );
  }
  // Durak tablosundan önceki kayıtlar: özet adreslerden türetilir.
  return [
    { type: 'pickup', sequence: 1, address: j.pickupAddress, point: point(j.pickupLatitude, j.pickupLongitude) },
    { type: 'delivery', sequence: 1, address: j.deliveryAddress, point: point(j.deliveryLatitude, j.deliveryLongitude) },
  ];
}

export function jobFromApi(j: ApiJob, history: ApiJobHistory[] = []): TransportJob {
  const stops = stopsFromApi(j);
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
    stops,
    // Eski kayıtlarda güzergah alanı boş olabilir; duraklardan üretilir.
    routeDescription: j.routeDescription?.trim() || buildRouteDescription(stops),
    description: j.description ?? '',
    price: j.price,
    driverId: j.assignedDriverId ?? undefined,
    notes: j.notes ?? '',
    status: jobStatusFromApi(j.status),
    // Liste yanıtında geçmiş yoktur; iş detayı açıldığında doldurulur.
    statusHistory: history.map(historyFromApi),
    pickupPoint: point(j.pickupLatitude, j.pickupLongitude),
    deliveryPoint: point(j.deliveryLatitude, j.deliveryLongitude),
    invoiceId: j.invoiceId ?? undefined,
    billingStatus: billingStatusFromApi(j.billingStatus),
    vehicleId: j.assignedVehicleId ?? undefined,
    vehiclePlate: j.assignedVehiclePlate ?? undefined,
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
    stops: toStops(input.stops).map((x) => ({
      stopType: stopTypeToApi(x.type),
      address: x.address,
      latitude: x.point?.latitude ?? null,
      longitude: x.point?.longitude ?? null,
      description: x.description ?? null,
    })),
    description: input.description.trim() || null,
    price: input.price,
    notes: orNull(input.notes ?? ''),
  };
}

export function vehicleFromApi(v: ApiVehicle): Vehicle {
  return {
    id: v.id,
    plate: v.plateNumber,
    type: vehicleTypeFromApi(v.vehicleType),
    brand: v.brand ?? '',
    model: v.model ?? '',
    isActive: v.isActive,
    description: v.description ?? '',
    driverId: v.driverId ?? undefined,
    driverName: v.driverName ?? undefined,
    assignedAt: v.assignedAt ?? undefined,
  };
}

export function vehicleToApi(v: VehicleInput) {
  return {
    plateNumber: v.plate.trim(),
    brand: orNull(v.brand),
    model: orNull(v.model),
    vehicleType: vehicleTypeToApi(v.type),
    description: orNull(v.description),
    isActive: v.isActive,
  };
}

export const customerAddressFromApi = (a: ApiCustomerAddress): CustomerAddress => ({
  type: stopTypeFromApi(a.stopType),
  address: a.address,
  point: point(a.latitude, a.longitude),
  useCount: a.useCount,
  lastUsedAt: a.lastUsedAt,
});

export const monthRevenueFromApi = (r: ApiMonthRevenue): MonthRevenue => ({
  year: r.year,
  month: r.month,
  revenue: r.revenue,
  completedJobs: r.completedJobs,
  currency: r.currency,
});

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
    jobCount: i.jobCount,
    issueDate: i.invoiceDate,
    description: i.description ?? '',
    subtotal: i.subTotal,
    vatRate: i.vatRate,
    vatAmount: i.vatAmount,
    total: i.grandTotal,
    // Liste yanıtında e-posta durumu yoktur; detay açıldığında güncellenir.
    email: { to: i.customerEmail ?? '', status: i.status === 'Issued' ? 'queued' : 'not_sent' },
    externalId: i.eArchiveInvoiceNumber ?? undefined,
    withholdingCode: i.withholdingCode ?? undefined,
    withholdingAmount: i.withholdingAmount ?? 0,
    payableAmount: i.payableAmount ?? i.grandTotal,
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
    jobIds: i.items.map((x) => x.jobId),
    jobNos: i.items.map((x) => x.jobNumber),
    jobCount: i.items.length,
    items: i.items.map((x) => ({ jobId: x.jobId, jobNo: x.jobNumber, jobDate: x.jobDate, storeName: x.storeName, description: x.description, amount: x.lineTotal })),
    lastError: i.lastError ?? undefined,
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
    withholdingCode: i.withholdingCode ?? undefined,
    withholdingName: i.withholdingName ?? undefined,
    withholdingRate: i.withholdingRate,
    withholdingAmount: i.withholdingAmount,
    payableAmount: i.payableAmount,
    amountInWords: i.amountInWords,
    iban: i.iban ?? undefined,
    bankName: i.bankName ?? undefined,
    requiresSmsSignature: i.requiresSmsSignature,
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
