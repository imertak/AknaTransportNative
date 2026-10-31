import { APP_CONFIG } from '@/constants/config';
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
import { mockAuthService } from './authService';
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
import { mockCustomerService } from './customerService';
import { mockDashboardService } from './dashboardService';
import { mockInvoiceService, pendingEArchiveGateway, pendingInvoiceMailer } from './invoiceService';
import { mockJobService } from './jobService';
import { mockLocationRepository } from './locationService';
import { mockUserService } from './userService';
import { mockVehicleService } from './vehicleService';

/**
 * Servis kayıt noktası. `EXPO_PUBLIC_API_BASE_URL` tanımlıysa (`APP_CONFIG.dataSource === 'api'`)
 * .NET Web API implementasyonları, değilse cihaz üzerindeki demo servisler kullanılır.
 * Ekran kodu yalnızca bu sözleşmeleri bilir.
 */
const apiMode = APP_CONFIG.dataSource === 'api';

export const authService: AuthService = apiMode ? apiAuthService : mockAuthService;
export const userService: UserService = apiMode ? apiUserService : mockUserService;
export const jobService: JobService = apiMode ? apiJobService : mockJobService;
export const customerService: CustomerService = apiMode ? apiCustomerService : mockCustomerService;
export const invoiceService: InvoiceService = apiMode ? apiInvoiceService : mockInvoiceService;
export const locationRepository: LocationRepository = apiMode ? apiLocationRepository : mockLocationRepository;
export const eArchiveGateway: EArchiveGateway = apiMode ? apiEArchiveGateway : pendingEArchiveGateway;
export const invoiceMailer: InvoiceMailer = apiMode ? apiInvoiceMailer : pendingInvoiceMailer;
export const vehicleService: VehicleService = apiMode ? apiVehicleService : mockVehicleService;
export const dashboardService: DashboardService = apiMode ? apiDashboardService : mockDashboardService;
