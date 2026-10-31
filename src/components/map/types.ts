import type { GeoPoint } from '@/types';

export type MapMarkerKind = 'vehicle' | 'pickup' | 'delivery';

export interface MapMarkerData {
  id: string;
  kind: MapMarkerKind;
  coordinate: GeoPoint;
  title: string;
  subtitle?: string;
}

export interface MapCanvasProps {
  markers: MapMarkerData[];
  focusId?: string | null;
  showsUserLocation?: boolean;
  onMarkerPress?: (id: string) => void;
  /** Alt panel vb. için harita içerik boşluğu. */
  bottomInset?: number;
}
