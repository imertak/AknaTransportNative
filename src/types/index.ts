/**
 * Merkezi veri modelleri. Alan adları ileride .NET Web API DTO'larıyla
 * eşleşecek şekilde camelCase tutulur; tarihler ISO 8601 string'dir.
 */

export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // 2026-10-31T12:00:00.000Z

export type UserRole = 'admin' | 'driver';

/** Admin aynı zamanda şoför görünümünü kullanabilir. */
export type ViewMode = 'admin' | 'driver';

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  vehicleId?: string;
  isActive: boolean;
  /** Yönetici tarafından oluşturulan geçici şifreyle ilk girişte true döner. */
  mustChangePassword?: boolean;
}

export interface Session {
  token: string;
  userId: string;
  issuedAt: ISODateTime;
  /** API oturumlarında erişim token'ını yenilemek için kullanılır. */
  refreshToken?: string;
  expiresAt?: ISODateTime;
}

export type VehicleType = 'panelvan' | 'small_panelvan' | 'pickup' | 'truck' | 'other';

export interface Vehicle {
  id: string;
  plate: string;
  type: VehicleType;
  model: string;
}

export interface Customer {
  id: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  taxOffice: string;
  taxNumber: string;
  billingAddress: string;
  notes: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type CustomerInput = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;

export type JobStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'on_the_way'
  | 'loading'
  | 'delivering'
  | 'completed'
  | 'cancelled';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface JobStatusEvent {
  status: JobStatus;
  at: ISODateTime;
  byUserId: string;
  /** API'den gelen kayıtlarda değişikliği yapan kişinin adı. */
  byUserName?: string;
  note?: string;
}

export interface TransportJob {
  id: string;
  jobNo: string;
  customerId: string;
  /** Liste performansı ve PDF için müşteri adının anlık kopyası. */
  customerName: string;
  date: ISODate;
  storeName: string;
  vehicleType: VehicleType;
  pickupAddress: string;
  deliveryAddress: string;
  /** Birden fazla yükleme adresi varsa virgülle ayrılmış liste. */
  pickupAddresses?: string[];
  /** Birden fazla teslimat adresi varsa virgülle ayrılmış liste. */
  deliveryAddresses?: string[];
  description: string;
  price: number;
  driverId?: string;
  notes: string;
  status: JobStatus;
  statusHistory: JobStatusEvent[];
  pickupPoint?: GeoPoint;
  deliveryPoint?: GeoPoint;
  invoiceId?: string;
  createdBy: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type JobInput = Pick<
  TransportJob,
  | 'customerId'
  | 'date'
  | 'storeName'
  | 'vehicleType'
  | 'pickupAddress'
  | 'deliveryAddress'
  | 'description'
  | 'price'
  | 'notes'
> & { driverId?: string; pickupAddresses?: string[]; deliveryAddresses?: string[] };

export interface JobFilter {
  query?: string;
  statuses?: JobStatus[];
  customerId?: string;
  driverId?: string;
  dateFrom?: ISODate;
  dateTo?: ISODate;
}

/**
 * Demo faturalar uygulama içinde üretilir ve resmi geçerliliği yoktur.
 * e-Arşiv durumları API entegrasyonu için ayrılmıştır.
 */
export type InvoiceMode = 'demo' | 'earsiv';

export type InvoiceStatus =
  | 'demo_draft'
  | 'demo_created'
  | 'cancelled'
  | 'earsiv_pending'
  | 'earsiv_issued'
  | 'earsiv_failed';

export type InvoiceEmailStatus = 'not_sent' | 'queued' | 'sent' | 'failed';

export interface Invoice {
  id: string;
  invoiceNo: string;
  mode: InvoiceMode;
  status: InvoiceStatus;
  customerId: string;
  customerName: string;
  /** Geriye uyumluluk: tek iş faturası için dolu. */
  jobId: string;
  jobNo: string;
  /** Birden fazla iş faturalandığında iş kimlikleri. */
  jobIds?: string[];
  jobNos?: string[];
  issueDate: ISODate;
  description: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  email: { to: string; status: InvoiceEmailStatus; sentAt?: ISODateTime };
  /** e-Arşiv entegrasyonunda dolacak alanlar. */
  externalId?: string;
  ettn?: string;
  createdAt: ISODateTime;
}

export type InvoiceInput = Pick<Invoice, 'issueDate' | 'description' | 'subtotal' | 'vatRate'> & {
  jobId?: string;
  jobIds?: string[];
};

export interface LocationFix extends GeoPoint {
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

export interface VehicleLocation {
  jobId: string;
  driverId: string;
  fix: LocationFix;
  /** Demo kayıtlar için gerçek GPS'ten gelmediğini belirtir. */
  simulated?: boolean;
}

export interface DateRange {
  from: ISODate;
  to: ISODate;
}

export interface JobsReport {
  range: DateRange;
  jobs: TransportJob[];
  totalCount: number;
  totalAmount: number;
  generatedAt: ISODateTime;
}
