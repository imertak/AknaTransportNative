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

/** Araç tipinin kodu (ör. "Panelvan"). Tipler yönetici tarafından eklenir; ekranda adı gösterilir. */
export type VehicleType = string;

/** Yöneticinin tanımladığı araç tipi. Pasif tipler yeni kayıtlarda seçilemez, eski kayıtlarda adıyla görünür. */
export interface VehicleTypeDef {
  id: string;
  code: VehicleType;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

/** Yönetici tarafından kaydedilen araç. Bir araç aynı anda yalnızca bir şoföre aktif olarak atanır. */
export interface Vehicle {
  id: string;
  plate: string;
  type: VehicleType;
  brand: string;
  model: string;
  isActive: boolean;
  description: string;
  /** Aracın şu anki aktif şoförü. */
  driverId?: string;
  driverName?: string;
  assignedAt?: ISODateTime;
}

export type VehicleInput = Pick<Vehicle, 'plate' | 'type' | 'brand' | 'model' | 'description' | 'isActive'>;

export interface Customer {
  id: string;
  companyName: string;
  contactName: string;
  phone: string;
  /** Ana e-posta (faturanın gönderildiği adres). */
  email: string;
  /** Ek e-posta adresleri; fatura e-postası bunlara bilgi (CC) olarak gider. */
  extraEmails: string[];
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

export type StopType = 'pickup' | 'delivery';

/** İşin yükleme veya teslimat noktası. Sıra numarası tür içinde 1'den başlar. */
export interface JobStop {
  id?: string;
  type: StopType;
  sequence: number;
  address: string;
  point?: GeoPoint;
  description?: string;
}

export type JobStopInput = Omit<JobStop, 'id' | 'sequence'>;

/** İşin yetkili kişisi (yük sahibi, teslim alan vb.). */
export interface JobContact {
  /** Serbest metin görev, ör. "Yük sahibi". */
  role?: string;
  name?: string;
  phone: string;
}

/** Faturalandırılmadı / Taslak faturada / Faturalandırıldı. */
export type JobBillingStatus = 'not_invoiced' | 'in_draft' | 'invoiced';

export interface TransportJob {
  id: string;
  jobNo: string;
  customerId: string;
  /** Liste performansı ve PDF için müşteri adının anlık kopyası. */
  customerName: string;
  date: ISODate;
  storeName: string;
  vehicleType: VehicleType;
  /** İlk yükleme noktası (özet; listeler ve eski kayıtlar için). */
  pickupAddress: string;
  /** Son teslimat noktası (özet). */
  deliveryAddress: string;
  /** Önce tüm yükleme, sonra tüm teslimat noktaları; tür içinde sıra numarasına göre. */
  stops: JobStop[];
  /** Yetkili kişiler; şoför iş detayından arayabilir. */
  contacts: JobContact[];
  /** Duraklardan otomatik üretilen güzergah ("A - B - C"). Duraklar değişince yeniden üretilir. */
  routeDescription: string;
  /** Elle yazılan ek açıklama. Otomatik güzergahtan ayrı tutulur. */
  description: string;
  price: number;
  driverId?: string;
  notes: string;
  status: JobStatus;
  statusHistory: JobStatusEvent[];
  pickupPoint?: GeoPoint;
  deliveryPoint?: GeoPoint;
  invoiceId?: string;
  billingStatus: JobBillingStatus;
  vehicleId?: string;
  vehiclePlate?: string;
  createdBy: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** İptal denetimi (yalnızca iptal edilmiş işte dolu). */
  cancellationReason?: string;
  cancelledAt?: ISODateTime;
  cancelledByName?: string;
  /**
   * Mantıksal silme. Silinen iş standart listelerde gelmez; yalnızca yöneticinin "Silinen işler" ekranında görünür.
   * İptalden farklıdır: silinen işin durumu (status) değişmez.
   */
  isDeleted: boolean;
  deletedAt?: ISODateTime;
  deletedByName?: string;
  deletionReason?: string;
}

export type JobInput = Pick<TransportJob, 'customerId' | 'date' | 'storeName' | 'vehicleType' | 'description' | 'price' | 'notes'> & {
  stops: JobStopInput[];
  contacts: JobContact[];
  driverId?: string;
  /** Seçilen şoförün aktif araçlarından biri. */
  vehicleId?: string;
};

/** Müşterinin daha önceki işlerinde kullanılan adres. */
export interface CustomerAddress {
  type: StopType;
  address: string;
  point?: GeoPoint;
  useCount: number;
  lastUsedAt: ISODateTime;
}

/** Seçilen ayın tamamlanmış (iptal edilmemiş) işlerinden elde edilen gelir. */
export interface MonthRevenue {
  year: number;
  month: number;
  revenue: number;
  completedJobs: number;
  currency: string;
}

export interface JobFilter {
  query?: string;
  statuses?: JobStatus[];
  customerId?: string;
  driverId?: string;
  dateFrom?: ISODate;
  dateTo?: ISODate;
  billingStatus?: JobBillingStatus;
}

/**
 * Taslak (mode 'demo') faturalar henüz e-Arşiv'e kesilmemiştir ve resmi geçerliliği yoktur.
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
  /** Fatura kalemleri (detayda dolar). */
  items?: InvoiceItem[];
  /** Listede iş sayısı (kalemler yüklenmeden). */
  jobCount?: number;
  /** e-Arşiv sağlayıcısının son hata mesajı. */
  lastError?: string;
  issueDate: ISODate;
  description: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  email: { to: string; status: InvoiceEmailStatus; sentAt?: ISODateTime };
  /** "E-posta gönder" ile elle yapılan son gönderim (taslak faturalar dahil). */
  manualEmail?: { to: string; status: InvoiceEmailStatus; sentAt?: ISODateTime; requestedAt: ISODateTime; error?: string };
  /** KDV tevkifatı (kod yoksa tevkifat yok). Oran KDV'nin yüzdesidir: 2/10 → 20. */
  withholdingCode?: string;
  withholdingName?: string;
  withholdingRate?: number;
  withholdingAmount?: number;
  /** Ödenecek tutar: genel toplam − tevkifat. */
  payableAmount?: number;
  /** "YALNIZ: ... TÜRK LİRASI" */
  amountInWords?: string;
  iban?: string;
  bankName?: string;
  /** GİB portalında taslak; kesilmesi için SMS koduyla imzalanmalı. */
  requiresSmsSignature?: boolean;
  /** true: faturaya işler tek tek değil, tek kalem "Nakliye Bedeli" olarak yazılır (iş dökümü değişmez). */
  singleLine?: boolean;
  /** true: fatura başka yerde kesildi, PDF'i elle yüklendi (e-Arşiv referansı yok). */
  manual?: boolean;
  /** e-Arşiv entegrasyonunda dolacak alanlar. */
  externalId?: string;
  ettn?: string;
  createdAt: ISODateTime;
}

export interface InvoiceItem {
  jobId: string;
  jobNo: string;
  jobDate: ISODate;
  storeName: string;
  description: string;
  amount: number;
}

export type InvoiceInput = Pick<Invoice, 'issueDate' | 'description' | 'subtotal' | 'vatRate'> & {
  jobId?: string;
  jobIds?: string[];
  /** KDV tevkifat kodu; null: tevkifat yok. */
  withholdingCode?: string | null;
  /** Boşsa firmanın varsayılan IBAN'ı kullanılır. */
  iban?: string;
  /** true: faturaya tek kalem "Nakliye Bedeli" yazılır; işler yalnızca dökümde ayrı ayrı yer alır. */
  singleLine?: boolean;
};

export type { WithholdingType } from '@/utils/invoiceText';

export interface InvoiceFilter {
  customerId?: string;
  dateFrom?: ISODate;
  dateTo?: ISODate;
  status?: 'draft' | 'issued' | 'cancelled' | 'failed';
}

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
