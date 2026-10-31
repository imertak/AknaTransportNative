import type { GeoPoint } from '@/types';

export interface AddressMapModalProps {
  visible: boolean;
  address: string;
  /** Daha önce kaydedilmiş konum varsa harita buradan açılır, adres aranmaz. */
  initialPoint?: GeoPoint;
  onClose: () => void;
  /** Kullanıcının onayladığı pin konumu. */
  onConfirm: (point: GeoPoint) => void;
}
