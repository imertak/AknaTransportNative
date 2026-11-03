import { Marker } from '@maplibre/maplibre-react-native';
import { Navigation2 } from 'lucide-react-native';
import { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { MAP_CONFIG } from '@/constants/config';
import { useAnimatedCoordinate } from '@/hooks/useAnimatedCoordinate';
import { colors } from '@/theme';
import type { GeoPoint } from '@/types';
import { distanceMeters } from '@/utils/geo';
import type { MapVehicle } from './types';

const STALE_COLOR = '#8C8C8C';

/** İki nokta arasındaki yön (derece). */
function bearing(a: GeoPoint, b: GeoPoint): number {
  const toRad = Math.PI / 180;
  const y = Math.sin((b.longitude - a.longitude) * toRad) * Math.cos(b.latitude * toRad);
  const x =
    Math.cos(a.latitude * toRad) * Math.sin(b.latitude * toRad) -
    Math.sin(a.latitude * toRad) * Math.cos(b.latitude * toRad) * Math.cos((b.longitude - a.longitude) * toRad);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * GPS yönü varsa onu, yoksa (duran araçta cihaz -1/null verir) son anlamlı hareketin yönünü kullanır.
 * Araç dururken ok rastgele dönmez.
 */
function useHeading(coordinate: GeoPoint, heading: number | null | undefined): number | null {
  const [last, setLast] = useState<{ point: GeoPoint; heading: number | null }>({ point: coordinate, heading: heading != null && heading >= 0 ? heading : null });
  let next: typeof last | null = null;
  if (heading != null && heading >= 0) {
    if (heading !== last.heading || coordinate !== last.point) next = { point: coordinate, heading };
  } else if (distanceMeters(last.point, coordinate) > 15) {
    next = { point: coordinate, heading: bearing(last.point, coordinate) };
  }
  // Türetilmiş durum: render sırasında koşullu güncelleme (React'in önerdiği kalıp).
  if (next) setLast(next);
  return next ? next.heading : last.heading;
}

interface Props extends MapVehicle {
  selected: boolean;
  onPress?: (id: string) => void;
}

/**
 * Araç işaretçisi: siyah daire içinde hareket yönünü gösteren ok ve altında plaka. Konum değişince
 * işaretçi yeni noktaya kayar; yalnızca bu bileşen yeniden çizilir.
 */
export const VehicleMarker = memo(function VehicleMarker({ id, coordinate, heading, label, stale, self, selected, onPress }: Props) {
  const animated = useAnimatedCoordinate(coordinate, MAP_CONFIG.markerAnimationMs);
  const direction = useHeading(coordinate, heading);
  const fill = stale ? STALE_COLOR : colors.ink;

  return (
    <Marker id={`vehicle-${id}`} lngLat={[animated.longitude, animated.latitude]} anchor="top" offset={[0, -21]} onPress={() => onPress?.(id)}>
      <View style={styles.wrap} accessibilityRole="button" accessibilityLabel={label ? `Araç ${label}` : 'Araç'}>
        <View style={[styles.ring, selected && styles.ringSelected]}>
          <View style={[styles.body, { backgroundColor: fill }, self && styles.bodySelf]}>
            <View style={{ transform: [{ rotate: `${direction ?? 0}deg` }] }}>
              <Navigation2 size={self ? 15 : 17} color={colors.textInverse} fill={colors.textInverse} strokeWidth={1.5} />
            </View>
          </View>
        </View>
        {label && !self ? (
          <View style={[styles.label, selected && styles.labelSelected]}>
            <Text variant="caption" style={[styles.labelText, selected && { color: colors.textInverse }]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ) : null}
        {stale ? <View style={styles.staleDot} /> : null}
      </View>
    </Marker>
  );
});

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: 96 },
  ring: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  ringSelected: { backgroundColor: 'rgba(211, 47, 47, 0.18)', borderWidth: 2, borderColor: colors.accent },
  body: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  bodySelf: { width: 28, height: 28, borderRadius: 14 },
  label: {
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    maxWidth: 96,
  },
  labelSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  labelText: { color: colors.text, letterSpacing: 0.3, textTransform: 'none' },
  staleDot: {
    position: 'absolute',
    top: 2,
    right: 26,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
