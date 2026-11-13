import type { ISODate, ISODateTime, VehicleType } from './index';

/**
 * Nakliye teklifi tipleri. Alan adları ve enum değerleri API ile birebir aynıdır (`/api/transport-offers`).
 * `Expired` saklanmaz: süresi geçmiş taslak/bekleyen teklif için sunucu okurken döndürür.
 */
export type OfferStatus = 'Draft' | 'Pending' | 'Accepted' | 'Rejected' | 'Expired' | 'Cancelled';
export type TransportType = 'Full' | 'Partial';

export interface OfferListItem {
  id: string;
  offerNumber: string;
  offerDate: ISODate;
  validUntil: ISODate;
  customerId: string;
  customerName: string;
  loadingPoint: string;
  unloadingPoint: string;
  transportType: TransportType;
  vehicleType: VehicleType;
  totalAmount: number;
  currency: string;
  status: OfferStatus;
  convertedJobId: string | null;
  createdAt: ISODateTime;
}

export interface OfferItem {
  id: string;
  sequence: number;
  description: string;
  unit: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OfferHistory {
  id: string;
  oldStatus: OfferStatus | null;
  newStatus: OfferStatus;
  description: string | null;
  changedByUserId: string;
  changedByUserName: string | null;
  createdAt: ISODateTime;
}

export interface OfferDetail {
  id: string;
  offerNumber: string;
  offerDate: ISODate;
  validUntil: ISODate;
  status: OfferStatus;
  storedStatus: OfferStatus;
  customerId: string;
  customerName: string;
  contactPerson: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  loadingPoint: string;
  loadingAddress: string | null;
  unloadingPoint: string;
  unloadingAddress: string | null;
  transportType: TransportType;
  vehicleType: VehicleType;
  vehicleTypeName: string;
  cargoDescription: string | null;
  loadingDate: ISODate | null;
  deliveryDate: ISODate | null;
  distanceKm: number | null;
  items: OfferItem[];
  subTotal: number;
  discountAmount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  currency: string;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  customerNotes: string | null;
  internalNotes: string | null;
  sentAt: ISODateTime | null;
  acceptedAt: ISODateTime | null;
  rejectedAt: ISODateTime | null;
  rejectionReason: string | null;
  cancelledAt: ISODateTime | null;
  cancellationReason: string | null;
  convertedJobId: string | null;
  convertedJobNumber: string | null;
  convertedAt: ISODateTime | null;
  copiedFromOfferId: string | null;
  createdByUserName: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime | null;
  canEdit: boolean;
  canSend: boolean;
  canAccept: boolean;
  canReject: boolean;
  canCancel: boolean;
  canConvert: boolean;
  canDelete: boolean;
  pdfFileName: string;
  history: OfferHistory[];
}

export interface OfferStats {
  total: number;
  draft: number;
  pending: number;
  accepted: number;
  rejected: number;
  expired: number;
  cancelled: number;
  acceptedAmount: number;
  pendingAmount: number;
}

export interface OfferFilter {
  search?: string;
  status?: OfferStatus;
  customerId?: string;
  /** Teklif tarihine göre (dahil). */
  startDate?: ISODate;
  endDate?: ISODate;
}

/** Kayıt isteği. Tutarlar sunucuda kalemlerden yeniden hesaplanır; toplam gönderilmez. */
export interface OfferInput {
  customerId?: string;
  customer?: { companyName: string; contactPerson?: string; phoneNumber?: string; email?: string; address?: string };
  offerDate: ISODate;
  validUntil: ISODate;
  loadingPoint: string;
  loadingAddress?: string;
  unloadingPoint: string;
  unloadingAddress?: string;
  transportType: TransportType;
  vehicleType: VehicleType;
  cargoDescription?: string;
  loadingDate?: ISODate;
  deliveryDate?: ISODate;
  distanceKm?: number;
  items: { description: string; unit?: string; quantity: number; unitPrice: number }[];
  discountAmount: number;
  vatRate: number;
  currency: 'TRY';
  paymentTerms?: string;
  deliveryTerms?: string;
  customerNotes?: string;
  internalNotes?: string;
}

export interface ConvertOfferResult {
  offer: OfferDetail;
  jobId: string;
  jobNumber: string;
}
