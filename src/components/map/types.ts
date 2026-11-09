import type { GeoPoint } from '@/types';

export type MapStopKind = 'pickup' | 'delivery';

/** Haritadaki araç. Konum değiştiğinde yalnızca bu aracın işaretçisi güncellenir (yumuşak kayarak). */
export interface MapVehicle {
  id: string;
  coordinate: GeoPoint;
  /** GPS yönü (derece, 0 = kuzey). Bilinmiyorsa son hareket yönü kullanılır. */
  heading?: number | null;
  /** İşaretçi altındaki kısa etiket (plaka veya şoför). */
  label?: string;
  /** Son konum eski: gri gösterilir. */
  stale?: boolean;
  /** Şoförün kendi cihazı (yalnızca ok, etiket yok). */
  self?: boolean;
}

/** Yükleme veya teslimat noktası. `order` haritada gösterilen sıra numarasıdır. */
export interface MapStop {
  id: string;
  kind: MapStopKind;
  order: number;
  coordinate: GeoPoint;
  title: string;
  subtitle?: string;
  /** Tamamlanmış/geçilmiş durak soluk gösterilir. */
  done?: boolean;
  /** Aracın şu an gittiği durak: turuncu gösterilir. */
  target?: boolean;
}

export interface MapRoute {
  coordinates: GeoPoint[];
  /** true: gerçek yol geometrisi; false: duraklar arası düz bağlantı (kesikli çizilir). */
  precise: boolean;
}

export interface MapCanvasProps {
  vehicles?: MapVehicle[];
  stops?: MapStop[];
  route?: MapRoute | null;
  /** Araçtan gidilen durağa kalan yol: güzergâhın üstünde kalın çizilir, güzergâh soluklaşır. */
  leg?: MapRoute | null;
  /** Seçili araç: vurgulanır. */
  selectedVehicleId?: string | null;
  /**
   * Canlı takip: seçili aracı her konum güncellemesinde ekranda ortalar. false ise kamera yalnızca
   * `fitKey` değiştiğinde tüm noktaları sığdırır (konum güncellemeleri kamerayı oynatmaz).
   */
  follow?: boolean;
  /** Değiştiğinde kamera tüm araç ve durakları sığdırır (ör. "fleet", seçili iş kimliği). */
  fitKey?: string;
  onVehiclePress?: (id: string) => void;
  onStopPress?: (id: string) => void;
  /** Boş bir yere dokunulunca (seçimi kaldırmak için). */
  onMapPress?: () => void;
  /** Kullanıcı haritayı elle kaydırdı (takip modundan çıkmak için). */
  onUserGesture?: () => void;
  /** Alt/üst panellerin kapladığı alan; kamera bu boşluğu hesaba katar. */
  bottomInset?: number;
  topInset?: number;
}
