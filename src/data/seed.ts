import type {
  Customer,
  GeoPoint,
  Invoice,
  JobStatus,
  JobStatusEvent,
  TransportJob,
  User,
  Vehicle,
  VehicleLocation,
  VehicleType,
} from '@/types';
import { addDays, todayISO } from '@/utils/format';

/**
 * Yalnızca frontend demo verisi. API aşamasında bu dosya kullanılmayacak.
 * İletişim bilgileri örnek amaçlıdır (.example alan adları).
 */

export const DEMO_PASSWORD = '123456';

export const seedUsers: User[] = [
  { id: 'u_admin', fullName: 'Akna Yönetici', email: 'admin@akna.com', phone: '05320000000', role: 'admin', vehicleId: 'v_100', isActive: true },
  { id: 'u_ahmet', fullName: 'Ahmet Yılmaz', email: 'driver@akna.com', phone: '05320000001', role: 'driver', vehicleId: 'v_101', isActive: true },
  { id: 'u_murat', fullName: 'Murat Kaya', email: 'murat@akna.com', phone: '05320000002', role: 'driver', vehicleId: 'v_102', isActive: true },
  { id: 'u_emre', fullName: 'Emre Demir', email: 'emre@akna.com', phone: '05320000003', role: 'driver', vehicleId: 'v_103', isActive: true },
];

export const seedVehicles: Vehicle[] = [
  { id: 'v_100', plate: '34 AKN 100', type: 'panelvan', model: 'Ford Transit' },
  { id: 'v_101', plate: '34 AKN 101', type: 'panelvan', model: 'Ford Transit' },
  { id: 'v_102', plate: '34 AKN 102', type: 'small_panelvan', model: 'Fiat Doblo Maxi' },
  { id: 'v_103', plate: '34 AKN 103', type: 'pickup', model: 'Isuzu NPR' },
];

const created = '2026-10-01T08:00:00.000Z';

export const seedCustomers: Customer[] = [
  {
    id: 'c_starbucks',
    companyName: 'Starbucks',
    contactName: 'Mağaza Operasyon Birimi',
    phone: '02120000001',
    email: 'operasyon@starbucks.example',
    taxOffice: 'Demo Vergi Dairesi',
    taxNumber: '1000000001',
    billingAddress: 'İstanbul (demo adres)',
    notes: 'Haliç Tersane ve Gebze TLS arası düzenli sevkiyat.',
    createdAt: created,
    updatedAt: created,
  },
  {
    id: 'c_calvin',
    companyName: 'Calvin Klein',
    contactName: 'Mağaza Kurulum Ekibi',
    phone: '02120000002',
    email: 'kurulum@calvinklein.example',
    taxOffice: 'Demo Vergi Dairesi',
    taxNumber: '1000000002',
    billingAddress: 'İstanbul (demo adres)',
    notes: 'Zorlu AVM mağaza teslimatları.',
    createdAt: created,
    updatedAt: created,
  },
  {
    id: 'c_bestseller',
    companyName: 'Bestseller',
    contactName: 'Lojistik Sorumlusu',
    phone: '02120000003',
    email: 'lojistik@bestseller.example',
    taxOffice: 'Demo Vergi Dairesi',
    taxNumber: '1000000003',
    billingAddress: 'İstanbul (demo adres)',
    notes: 'Vadi İstanbul iade sevkiyatları.',
    createdAt: created,
    updatedAt: created,
  },
];

const P = {
  halic: { latitude: 41.0402, longitude: 28.9519 },
  zorlu: { latitude: 41.0671, longitude: 29.0173 },
  ikitelli: { latitude: 41.0712, longitude: 28.8019 },
  vadi: { latitude: 41.1106, longitude: 28.9876 },
  beylikduzu: { latitude: 40.9897, longitude: 28.6415 },
  gebze: { latitude: 40.8011, longitude: 29.4312 },
  dudullu: { latitude: 41.0058, longitude: 29.1602 },
} satisfies Record<string, GeoPoint>;

const FLOW: JobStatus[] = ['pending', 'assigned', 'accepted', 'on_the_way', 'loading', 'delivering', 'completed'];

function history(date: string, upTo: JobStatus, driverId?: string): JobStatusEvent[] {
  const end = FLOW.indexOf(upTo);
  return FLOW.slice(0, end + 1).map((status, i) => ({
    status,
    at: `${date}T${String(7 + i).padStart(2, '0')}:${i % 2 ? '30' : '05'}:00.000Z`,
    byUserId: status === 'pending' || status === 'assigned' ? 'u_admin' : driverId ?? 'u_admin',
  }));
}

interface SeedJobRow {
  date: string;
  customerId: string;
  vehicleType: VehicleType;
  pickup: string;
  delivery: string;
  description: string;
  price: number;
  status: JobStatus;
  driverId?: string;
  pickupPoint?: GeoPoint;
  deliveryPoint?: GeoPoint;
  notes?: string;
}

const customerName = (id: string) => seedCustomers.find((c) => c.id === id)!.companyName;

function buildJobs(): TransportJob[] {
  const today = todayISO();
  const rows: SeedJobRow[] = [
    // Excel iş dökümündeki kayıtlar
    { date: '2026-10-19', customerId: 'c_starbucks', vehicleType: 'panelvan', pickup: 'Portashelf', delivery: 'Haliç Tersane', description: 'Portashelf - Haliç Tersane', price: 4000, status: 'completed', driverId: 'u_ahmet' },
    { date: '2026-10-19', customerId: 'c_starbucks', vehicleType: 'panelvan', pickup: 'Gebze TLS', delivery: 'Haliç Tersane', description: 'Gebze TLS - Haliç Tersane', price: 8000, status: 'completed', driverId: 'u_ahmet' },
    { date: '2026-10-20', customerId: 'c_starbucks', vehicleType: 'panelvan', pickup: 'Haliç Tersane', delivery: 'Gebze TLS', description: 'Haliç Tersane - Gebze TLS (+1 eleman yevmiyesi - gece yükleme ertesi gün boşaltma)', price: 10000, status: 'completed', driverId: 'u_ahmet', notes: '+1 eleman yevmiyesi dahil.' },
    { date: '2026-10-20', customerId: 'c_starbucks', vehicleType: 'panelvan', pickup: 'Haliç Tersane', delivery: 'Dudullu Hokuha Halı', description: 'Haliç Tersane - Dudullu Hokuha Halı', price: 4000, status: 'completed', driverId: 'u_murat' },
    { date: '2026-10-20', customerId: 'c_calvin', vehicleType: 'small_panelvan', pickup: 'Ümraniye', delivery: 'Zorlu AVM', description: 'Ümraniye - İkitelli YS Metal - Zorlu AVM', price: 4000, status: 'completed', driverId: 'u_murat' },
    { date: '2026-10-21', customerId: 'c_calvin', vehicleType: 'small_panelvan', pickup: 'İkitelli Buroser', delivery: 'Zorlu AVM', description: 'İkitelli Buroser - Zorlu AVM', price: 3500, status: 'completed', driverId: 'u_murat' },
    { date: '2026-10-22', customerId: 'c_bestseller', vehicleType: 'panelvan', pickup: 'Akpınar Depo', delivery: 'Beylikdüzü 2000 Reklam', description: 'Akpınar Depo - Beylikdüzü 2000 Reklam (Vadi İstanbul Bestseller iadeleri)', price: 3000, status: 'completed', driverId: 'u_ahmet' },
    // Güncel operasyon örnekleri
    { date: today, customerId: 'c_starbucks', vehicleType: 'panelvan', pickup: 'Haliç Tersane', delivery: 'Zorlu AVM', description: 'Haliç Tersane - Zorlu AVM mağaza malzemesi', price: 4500, status: 'on_the_way', driverId: 'u_ahmet', pickupPoint: P.halic, deliveryPoint: P.zorlu },
    { date: today, customerId: 'c_calvin', vehicleType: 'small_panelvan', pickup: 'İkitelli Buroser', delivery: 'Zorlu AVM', description: 'İkitelli Buroser - Zorlu AVM vitrin ekipmanı', price: 3500, status: 'assigned', driverId: 'u_ahmet', pickupPoint: P.ikitelli, deliveryPoint: P.zorlu },
    { date: today, customerId: 'c_bestseller', vehicleType: 'panelvan', pickup: 'Vadi İstanbul', delivery: 'Beylikdüzü 2000 Reklam', description: 'Vadi İstanbul - Beylikdüzü 2000 Reklam iade sevkiyatı', price: 3000, status: 'loading', driverId: 'u_murat', pickupPoint: P.vadi, deliveryPoint: P.beylikduzu },
    { date: addDays(today, 1), customerId: 'c_starbucks', vehicleType: 'pickup', pickup: 'Gebze TLS', delivery: 'Haliç Tersane', description: 'Gebze TLS - Haliç Tersane', price: 8000, status: 'pending', pickupPoint: P.gebze, deliveryPoint: P.halic },
  ];

  return rows.map((r, i) => {
    const seq = i + 1;
    const statusHistory = r.status === 'pending' ? history(r.date, 'pending') : history(r.date, r.status, r.driverId);
    const last = statusHistory[statusHistory.length - 1]!.at;
    return {
      id: `j_${String(seq).padStart(4, '0')}`,
      jobNo: `AKN-2026-${String(seq).padStart(4, '0')}`,
      customerId: r.customerId,
      customerName: customerName(r.customerId),
      date: r.date,
      storeName: customerName(r.customerId),
      vehicleType: r.vehicleType,
      pickupAddress: r.pickup,
      deliveryAddress: r.delivery,
      description: r.description,
      price: r.price,
      driverId: r.driverId,
      notes: r.notes ?? '',
      status: r.status,
      statusHistory,
      pickupPoint: r.pickupPoint,
      deliveryPoint: r.deliveryPoint,
      invoiceId: seq === 1 ? 'inv_0001' : undefined,
      createdBy: 'u_admin',
      createdAt: statusHistory[0]!.at,
      updatedAt: last,
    };
  });
}

function buildInvoices(): Invoice[] {
  return [
    {
      id: 'inv_0001',
      invoiceNo: 'DEMO-2026-0001',
      mode: 'demo',
      status: 'demo_created',
      customerId: 'c_starbucks',
      customerName: 'Starbucks',
      jobId: 'j_0001',
      jobNo: 'AKN-2026-0001',
      issueDate: '2026-10-19',
      description: 'Portashelf - Haliç Tersane nakliye hizmeti',
      subtotal: 4000,
      vatRate: 20,
      vatAmount: 800,
      total: 4800,
      email: { to: 'operasyon@starbucks.example', status: 'not_sent' },
      createdAt: '2026-10-19T16:00:00.000Z',
    },
  ];
}

function buildLocations(): Record<string, VehicleLocation> {
  const now = Date.now();
  return {
    j_0008: {
      jobId: 'j_0008',
      driverId: 'u_ahmet',
      simulated: true,
      fix: { latitude: 41.0435, longitude: 28.9871, accuracy: 15, speed: 9, heading: 60, timestamp: now - 4 * 60_000 },
    },
    j_0010: {
      jobId: 'j_0010',
      driverId: 'u_murat',
      simulated: true,
      fix: { latitude: 41.1101, longitude: 28.9869, accuracy: 20, speed: 0, heading: 0, timestamp: now - 9 * 60_000 },
    },
  };
}

export interface MockDatabase {
  version: number;
  users: User[];
  vehicles: Vehicle[];
  customers: Customer[];
  jobs: TransportJob[];
  invoices: Invoice[];
  locations: Record<string, VehicleLocation>;
  counters: { job: number; invoice: number };
}

export const MOCK_DB_VERSION = 1;

export function createSeedDatabase(): MockDatabase {
  const jobs = buildJobs();
  return {
    version: MOCK_DB_VERSION,
    users: seedUsers,
    vehicles: seedVehicles,
    customers: seedCustomers,
    jobs,
    invoices: buildInvoices(),
    locations: buildLocations(),
    counters: { job: jobs.length, invoice: 1 },
  };
}
