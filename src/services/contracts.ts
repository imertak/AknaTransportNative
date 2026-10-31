import type {
  Customer,
  CustomerInput,
  Invoice,
  InvoiceInput,
  JobFilter,
  JobInput,
  JobStatus,
  Session,
  TransportJob,
  User,
  Vehicle,
  VehicleLocation,
} from '@/types';

/**
 * Servis sözleşmeleri. Mock ve ileride yazılacak .NET Web API
 * implementasyonları bu arayüzleri uygular; ekranlar yalnızca bunları bilir.
 */

export interface AuthService {
  login(email: string, password: string): Promise<{ session: Session; user: User }>;
  restore(session: Session): Promise<User | null>;
  logout(session: Session): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  /** E-postayla gelen sıfırlama koduyla yeni şifre belirler. */
  resetPassword(email: string, code: string, newPassword: string): Promise<void>;
  /** Erişim token'ını yeniler. Yenilenemezse hata fırlatır. */
  refresh(session: Session): Promise<Session>;
  /** Geçici şifreyle ilk girişten sonra veya profilden şifre değişikliği. */
  changePassword(currentPassword: string, newPassword: string): Promise<{ session: Session; user: User }>;
}

export interface UserService {
  list(): Promise<User[]>;
  listVehicles(): Promise<Vehicle[]>;
}

export interface JobService {
  list(filter?: JobFilter): Promise<TransportJob[]>;
  get(id: string): Promise<TransportJob>;
  create(input: JobInput, actorId: string): Promise<TransportJob>;
  update(id: string, input: JobInput, actorId: string): Promise<TransportJob>;
  /** driverId null ise atama kaldırılır ve iş Bekliyor durumuna döner. */
  assign(id: string, driverId: string | null, actorId: string): Promise<TransportJob>;
  /** Admin işi kendisi üstlenir: kendisine atanır ve kabul edilmiş sayılır. */
  takeOver(id: string, actorId: string): Promise<TransportJob>;
  /** Şoför akışındaki bir sonraki duruma geçirir. */
  advance(id: string, next: JobStatus, actorId: string): Promise<TransportJob>;
  cancel(id: string, actorId: string, reason?: string): Promise<TransportJob>;
}

export interface CustomerService {
  list(): Promise<Customer[]>;
  get(id: string): Promise<Customer>;
  create(input: CustomerInput): Promise<Customer>;
  update(id: string, input: CustomerInput): Promise<Customer>;
  remove(id: string): Promise<void>;
}

export interface InvoiceService {
  list(): Promise<Invoice[]>;
  get(id: string): Promise<Invoice>;
  /** Uygulama içi demo fatura. Resmi geçerliliği yoktur. */
  createDemo(input: InvoiceInput, actorId: string): Promise<Invoice>;
  cancel(id: string): Promise<Invoice>;
}

/** e-Arşiv entegratörü sözleşmesi (API aşamasında backend üzerinden çağrılacak). */
export interface EArchiveGateway {
  issue(invoiceId: string): Promise<{ ettn: string; externalId: string; status: 'earsiv_pending' | 'earsiv_issued' }>;
  getStatus(invoiceId: string): Promise<Invoice['status']>;
  cancel(invoiceId: string, reason: string): Promise<void>;
}

/** Faturanın müşteriye e-posta ile iletilmesi (backend tarafında yapılacak). */
export interface InvoiceMailer {
  send(invoiceId: string, to: string): Promise<{ status: 'queued' | 'sent' }>;
}

/** Konum verisinin sunucuya iletildiği/okunduğu katman. */
export interface LocationRepository {
  publish(location: VehicleLocation): Promise<void>;
  listActive(): Promise<VehicleLocation[]>;
  clear(jobId: string): Promise<void>;
}
