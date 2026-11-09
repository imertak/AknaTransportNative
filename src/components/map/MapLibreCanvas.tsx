import { Camera, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';
import { mapStyle } from '@/theme/map';
import type { GeoPoint } from '@/types';
import { ISTANBUL_CENTER } from '@/utils/geo';
import { RouteLayer } from './RouteLayer';
import { StopMarker } from './StopMarker';
import type { MapCanvasProps } from './types';
import { VehicleMarker } from './VehicleMarker';

const FOLLOW_ZOOM = 15;

function boundsOf(points: GeoPoint[]): [number, number, number, number] | null {
  if (points.length === 0) return null;
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const p of points) {
    w = Math.min(w, p.longitude);
    e = Math.max(e, p.longitude);
    s = Math.min(s, p.latitude);
    n = Math.max(n, p.latitude);
  }
  // Tek nokta veya çok yakın noktalarda aşırı yakınlaşmayı önler (~1 km).
  const pad = 0.006;
  if (e - w < pad) [w, e] = [w - pad, e + pad];
  if (n - s < pad) [s, n] = [s - pad, n + pad];
  return [w, s, e, n];
}

/**
 * AKNA haritası (MapLibre Native + OpenStreetMap, açık gri tema). Araçlar, sıralı duraklar, iş güzergâhı ve
 * araçtan gidilen durağa kalan yol tek bileşende çizilir. Harita bir kez kurulur; konum güncellemelerinde yalnızca ilgili araç
 * işaretçisi değişir, stil ve kaynaklar yeniden yüklenmez.
 */
export const MapLibreCanvas = memo(function MapLibreCanvas({
  vehicles = [],
  stops = [],
  route,
  leg,
  selectedVehicleId,
  follow = false,
  fitKey = 'default',
  onVehiclePress,
  onStopPress,
  onMapPress,
  onUserGesture,
  bottomInset = 0,
  topInset = 0,
}: MapCanvasProps) {
  const camera = useRef<CameraRef>(null);
  const padding = useMemo(() => ({ top: topInset + 60, right: 48, bottom: bottomInset + 48, left: 48 }), [topInset, bottomInset]);

  // Kamera hedefleri; ref'te tutulur ki konum güncellemeleri sığdırma efektini tetiklemesin.
  const pointsRef = useRef<GeoPoint[]>([]);
  pointsRef.current = [...vehicles.map((v) => v.coordinate), ...stops.map((s) => s.coordinate), ...(route?.coordinates ?? []), ...(leg?.coordinates ?? [])];

  const fit = useCallback(() => {
    const b = boundsOf(pointsRef.current);
    if (b) camera.current?.fitBounds(b, { padding, duration: 600, easing: 'ease' });
  }, [padding]);

  // fitKey değişince (filo görünümüne dönüş, iş değişimi) tüm noktalar sığdırılır. Takipten elle
  // çıkılması (kaydırma) kamerayı oynatmaz; kullanıcının baktığı yer korunur.
  const followRef = useRef(follow);
  followRef.current = follow;
  const hasPoints = pointsRef.current.length > 0;
  useEffect(() => {
    if (!followRef.current) fit();
  }, [fitKey, hasPoints, fit]);

  // Canlı takip: seçili araç her yeni konumda ortalanır.
  const followed = follow && selectedVehicleId ? vehicles.find((v) => v.id === selectedVehicleId) : undefined;
  const followLat = followed?.coordinate.latitude;
  const followLng = followed?.coordinate.longitude;
  const followStarted = useRef(false);
  useEffect(() => {
    if (followLat == null || followLng == null) {
      followStarted.current = false;
      return;
    }
    camera.current?.easeTo({
      center: [followLng, followLat],
      ...(followStarted.current ? null : { zoom: FOLLOW_ZOOM }),
      padding,
      duration: followStarted.current ? 1000 : 700,
      easing: 'ease',
    });
    followStarted.current = true;
  }, [followLat, followLng, padding]);

  const initial = useMemo(() => {
    const b = boundsOf(pointsRef.current);
    return b ? { bounds: b, padding } : { center: [ISTANBUL_CENTER.longitude, ISTANBUL_CENTER.latitude] as [number, number], zoom: 10 };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.root}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyle}
        logo={false}
        compass={false}
        scaleBar={false}
        // Kuzey hep yukarıda: araç okları gerçek yönü gösterir.
        touchRotate={false}
        touchPitch={false}
        attribution
        attributionPosition={{ bottom: bottomInset + 8, left: 8 }}
        tintColor={colors.ink}
        onPress={() => onMapPress?.()}
        onRegionWillChange={(e) => {
          if (e.nativeEvent.userInteraction) onUserGesture?.();
        }}>
        <Camera ref={camera} initialViewState={initial} maxZoom={18} minZoom={3} />
        {route && route.coordinates.length > 1 ? <RouteLayer route={route} tone={leg ? 'muted' : 'job'} /> : null}
        {leg && leg.coordinates.length > 1 ? <RouteLayer id="akna-leg" route={leg} tone="leg" /> : null}
        {stops.map((s) => (
          <StopMarker key={s.id} {...s} onPress={onStopPress} />
        ))}
        {vehicles.map((v) => (
          <VehicleMarker key={v.id} {...v} selected={v.id === selectedVehicleId} onPress={onVehiclePress} />
        ))}
      </Map>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: colors.background },
});
