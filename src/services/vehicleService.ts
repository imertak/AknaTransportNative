import type { MockDatabase } from '@/data/seed';
import type { Vehicle, VehicleInput } from '@/types';
import { createId } from '@/utils/id';
import type { VehicleService } from './contracts';
import { ServiceError } from './errors';
import { mockDb } from './mockDb';

/** API'deki Vehicle.NormalizePlate ile aynı: büyük harf, tek boşluk. */
export const normalizePlate = (plate: string) => plate.trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr-TR');

const sortVehicles = (a: Vehicle, b: Vehicle) => Number(b.isActive) - Number(a.isActive) || a.plate.localeCompare(b.plate, 'tr');

function find(db: MockDatabase, id: string) {
  const v = db.vehicles.find((x) => x.id === id);
  if (!v) throw new ServiceError('not_found', 'Araç bulunamadı.');
  return v;
}

function validate(db: MockDatabase, input: VehicleInput, id?: string) {
  const plate = normalizePlate(input.plate);
  if (plate.length < 5) throw new ServiceError('validation', 'Geçerli bir plaka girin.');
  if (db.vehicles.some((v) => v.id !== id && normalizePlate(v.plate) === plate)) {
    throw new ServiceError('conflict', `${plate} plakalı araç zaten kayıtlı.`);
  }
  return plate;
}

export const mockVehicleService: VehicleService = {
  list: () => mockDb.read((db) => [...db.vehicles].sort(sortVehicles)),

  // Mock modda oturum bağlamı servis katmanında yok; şoför ekranları kendi kimliğiyle filtreler.
  listMine: () => mockDb.read((db) => db.vehicles.filter((v) => v.isActive && v.driverId).sort(sortVehicles)),

  create: (input) =>
    mockDb.write((db) => {
      const plate = validate(db, input);
      const v: Vehicle = { ...input, id: createId('v'), plate, isActive: true, brand: input.brand.trim(), model: input.model.trim(), description: input.description.trim() };
      db.vehicles.push(v);
      return v;
    }),

  update: (id, input) =>
    mockDb.write((db) => {
      const v = find(db, id);
      const plate = validate(db, input, id);
      Object.assign(v, { ...input, plate, brand: input.brand.trim(), model: input.model.trim(), description: input.description.trim() });
      // Pasife alınan aracın şoför ataması sonlanır.
      if (!v.isActive) {
        v.driverId = undefined;
        v.driverName = undefined;
        v.assignedAt = undefined;
      }
      return v;
    }),

  assign: (id, driverId) =>
    mockDb.write((db) => {
      const v = find(db, id);
      if (!v.isActive) throw new ServiceError('conflict', 'Pasif araç şoföre atanamaz.');
      const driver = db.users.find((u) => u.id === driverId && u.isActive);
      if (!driver) throw new ServiceError('validation', 'Şoför bulunamadı veya pasif.');
      if (v.driverId && v.driverId !== driverId) {
        throw new ServiceError('conflict', `Bu araç şu anda ${v.driverName ?? 'başka bir şoföre'} atanmış. Önce atamayı kaldırın.`);
      }
      v.driverId = driver.id;
      v.driverName = driver.fullName;
      v.assignedAt = new Date().toISOString();
      return v;
    }),

  unassign: (id) =>
    mockDb.write((db) => {
      const v = find(db, id);
      v.driverId = undefined;
      v.driverName = undefined;
      v.assignedAt = undefined;
      return v;
    }),
};
