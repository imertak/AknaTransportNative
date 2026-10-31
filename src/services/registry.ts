import { mockAuthService } from './authService';
import type {
  AuthService,
  CustomerService,
  EArchiveGateway,
  InvoiceMailer,
  InvoiceService,
  JobService,
  LocationRepository,
  UserService,
} from './contracts';
import { mockCustomerService } from './customerService';
import { mockInvoiceService, pendingEArchiveGateway, pendingInvoiceMailer } from './invoiceService';
import { mockJobService } from './jobService';
import { mockLocationRepository } from './locationService';
import { mockUserService } from './userService';

/**
 * Servis kayıt noktası. API aşamasında yalnızca buradaki atamalar
 * `APP_CONFIG.dataSource === 'api'` durumuna göre API implementasyonlarıyla
 * değiştirilecek; ekran kodu değişmeyecek.
 */
export const authService: AuthService = mockAuthService;
export const userService: UserService = mockUserService;
export const jobService: JobService = mockJobService;
export const customerService: CustomerService = mockCustomerService;
export const invoiceService: InvoiceService = mockInvoiceService;
export const locationRepository: LocationRepository = mockLocationRepository;
export const eArchiveGateway: EArchiveGateway = pendingEArchiveGateway;
export const invoiceMailer: InvoiceMailer = pendingInvoiceMailer;
