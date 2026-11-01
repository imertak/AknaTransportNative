import {
  apiAuthService,
  apiCustomerService,
  apiDashboardService,
  apiEArchiveGateway,
  apiInvoiceMailer,
  apiInvoiceService,
  apiJobService,
  apiLocationRepository,
  apiUserService,
  apiVehicleService,
} from './api/apiServices';
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
} from './contracts';

/**
 * Servis kayıt noktası. Uygulama yalnızca AKNA .NET Web API ile çalışır; cihaz üzerinde demo veri yoktur.
 * API adresi `EXPO_PUBLIC_API_BASE_URL` ile verilir. Ekran kodu yalnızca bu sözleşmeleri bilir.
 */
export const authService: AuthService = apiAuthService;
export const userService: UserService = apiUserService;
export const jobService: JobService = apiJobService;
export const customerService: CustomerService = apiCustomerService;
export const invoiceService: InvoiceService = apiInvoiceService;
export const locationRepository: LocationRepository = apiLocationRepository;
export const eArchiveGateway: EArchiveGateway = apiEArchiveGateway;
export const invoiceMailer: InvoiceMailer = apiInvoiceMailer;
export const vehicleService: VehicleService = apiVehicleService;
export const dashboardService: DashboardService = apiDashboardService;
