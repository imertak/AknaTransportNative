import type { UserService } from './contracts';
import { mockDb } from './mockDb';

export const mockUserService: UserService = {
  list: () => mockDb.read((db) => db.users),
  listVehicles: () => mockDb.read((db) => db.vehicles),
};
