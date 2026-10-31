import type { Href } from 'expo-router';

import type { ViewMode } from '@/types';

/**
 * Uygulama içi rota tanımları tek yerde tutulur; ekranlar URL string'i
 * yerine bu yardımcıları kullanır.
 */
export const routes = {
  login: '/login' as Href,
  forgotPassword: '/forgot-password' as Href,
  home: (mode: ViewMode): Href => (mode === 'admin' ? '/admin/dashboard' : '/driver/home') as Href,

  job: (id: string, mode: ViewMode = 'admin'): Href => ({ pathname: mode === 'admin' ? '/admin/job/[id]' : '/driver/job/[id]', params: { id } }) as Href,
  newJob: (customerId?: string): Href => ({ pathname: '/admin/job-form', params: customerId ? { customerId } : {} }) as Href,
  editJob: (id: string): Href => ({ pathname: '/admin/job-form', params: { id } }) as Href,
  adminJobs: '/admin/jobs' as Href,

  customer: (id: string): Href => ({ pathname: '/admin/customer/[id]', params: { id } }) as Href,
  newCustomer: '/admin/customer-form' as Href,
  editCustomer: (id: string): Href => ({ pathname: '/admin/customer-form', params: { id } }) as Href,

  invoices: '/admin/invoices' as Href,
  invoice: (id: string): Href => ({ pathname: '/admin/invoice/[id]', params: { id } }) as Href,
  newInvoice: (jobId?: string): Href => ({ pathname: '/admin/invoice-form', params: jobId ? { jobId } : {} }) as Href,

  adminMap: '/admin/map' as Href,
  driverJobs: '/driver/jobs' as Href,
  driverMap: '/driver/map' as Href,
};
