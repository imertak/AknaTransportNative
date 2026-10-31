import type { CustomerInput } from '@/types';
import { createId } from '@/utils/id';
import { isEmail, isPhone, isTaxNumber, required } from '@/utils/validation';
import type { CustomerService } from './contracts';
import { ServiceError } from './errors';
import { mockDb } from './mockDb';

function validate(input: CustomerInput) {
  if (!required(input.companyName)) throw new ServiceError('validation', 'Firma adı zorunludur.');
  if (input.phone && !isPhone(input.phone)) throw new ServiceError('validation', 'Telefon numarası geçersiz.');
  if (input.email && !isEmail(input.email)) throw new ServiceError('validation', 'E-posta adresi geçersiz.');
  if (input.taxNumber && !isTaxNumber(input.taxNumber)) throw new ServiceError('validation', 'Vergi numarası 10 veya 11 haneli olmalıdır.');
}

export const mockCustomerService: CustomerService = {
  list: () => mockDb.read((db) => [...db.customers].sort((a, b) => a.companyName.localeCompare(b.companyName, 'tr'))),

  async get(id) {
    const c = await mockDb.read((db) => db.customers.find((x) => x.id === id) ?? null);
    if (!c) throw new ServiceError('not_found', 'Müşteri bulunamadı.');
    return c;
  },

  create: (input) =>
    mockDb.write((db) => {
      validate(input);
      const name = input.companyName.trim().toLocaleLowerCase('tr-TR');
      if (db.customers.some((c) => c.companyName.toLocaleLowerCase('tr-TR') === name)) {
        throw new ServiceError('conflict', 'Bu isimde bir müşteri zaten kayıtlı.');
      }
      const now = new Date().toISOString();
      const customer = { ...input, id: createId('c'), createdAt: now, updatedAt: now };
      db.customers.push(customer);
      return customer;
    }),

  update: (id, input) =>
    mockDb.write((db) => {
      validate(input);
      const c = db.customers.find((x) => x.id === id);
      if (!c) throw new ServiceError('not_found', 'Müşteri bulunamadı.');
      Object.assign(c, input, { updatedAt: new Date().toISOString() });
      // İş kayıtlarındaki müşteri adı kopyasını güncel tut
      db.jobs.forEach((j) => {
        if (j.customerId === id) j.customerName = c.companyName;
      });
      db.invoices.forEach((inv) => {
        if (inv.customerId === id && inv.mode === 'demo') inv.customerName = c.companyName;
      });
      return c;
    }),

  remove: (id) =>
    mockDb.write((db) => {
      if (db.jobs.some((j) => j.customerId === id)) {
        throw new ServiceError('conflict', 'İş kaydı bulunan müşteri silinemez.');
      }
      db.customers = db.customers.filter((c) => c.id !== id);
    }),
};
