import { Flag, MapPinOff, Truck } from 'lucide-react-native';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

import { Text } from '@/components/ui';
import { mapAvailability } from '@/services/geocoding';
import { colors, spacing } from '@/theme';
import { regionFor } from '@/utils/geo';
import type { MapCanvasProps, MapMarkerData } from './types';

const PinView = memo(function PinView({ kind }: { kind: MapMarkerData['kind'] }) {
  if (kind === 'vehicle') {
    return (
      <View style={styles.vehicle}>
        <Truck size={16} color={colors.textInverse} strokeWidth={2.2} />
      </View>
    );
  }
  if (kind === 'delivery') {
    return (
      <View style={styles.delivery}>
        <Flag size={14} color={colors.text} strokeWidth={2.2} />
      </View>
    );
  }
  return <View style={styles.pickup} />;
});

/**
 * Android'de Google Maps anahtarı olmadan MapView açılırsa uygulama yerel olarak çöker. Sağlayıcı
 * yapılandırılmamışsa harita yerine açıklama gösterilir (sahte harita yok).
 */
export const MapCanvas = memo(function MapCanvas(props: MapCanvasProps) {
  const availability = mapAvailability();
  if (!availability.available) {
    return (
      <View style={styles.unavailable}>
        <MapPinOff size={28} color={colors.textTertiary} />
        <Text variant="subheading" align="center">
          Harita kullanılamıyor
        </Text>
        <Text variant="bodySmall" tone="secondary" align="center">
          {availability.reason}
        </Text>
      </View>
    );
  }
  return <NativeMap {...props} />;
});

const NativeMap = memo(function NativeMap({ markers, focusId, showsUserLocation, onMarkerPress, bottomInset = 0 }: MapCanvasProps) {
  const ref = useRef<MapView>(null);
  // Özel marker görünümleri ilk çizimden sonra sabitlenir (Android'de gereksiz yeniden çizimi önler)
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    setTracks(true);
    const t = setTimeout(() => setTracks(false), 600);
    return () => clearTimeout(t);
  }, [markers.length]);

  const initialRegion = useMemo(() => regionFor(markers.map((m) => m.coordinate)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const coordsKey = markers.map((m) => `${m.coordinate.latitude.toFixed(4)},${m.coordinate.longitude.toFixed(4)}`).join('|');
  useEffect(() => {
    const focus = focusId ? markers.find((m) => m.id === focusId) : undefined;
    if (focus) {
      ref.current?.animateToRegion({ ...focus.coordinate, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 350);
    } else if (markers.length > 1) {
      ref.current?.fitToCoordinates(markers.map((m) => m.coordinate), {
        edgePadding: { top: 80, right: 60, bottom: 80 + bottomInset, left: 60 },
        animated: true,
      });
    } else if (markers.length === 1) {
      ref.current?.animateToRegion({ ...markers[0]!.coordinate, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 350);
    }
  }, [focusId, coordsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFill}
      provider={PROVIDER_DEFAULT}
      initialRegion={initialRegion}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
      showsPointsOfInterests={false}
      userInterfaceStyle="light"
      mapPadding={{ top: 0, right: 0, bottom: bottomInset, left: 0 }}>
      {markers.map((m) => (
        <Marker
          key={m.id}
          identifier={m.id}
          coordinate={m.coordinate}
          title={m.title}
          description={m.subtitle}
          tracksViewChanges={tracks}
          anchor={{ x: 0.5, y: 0.5 }}
          onPress={() => onMarkerPress?.(m.id)}>
          <PinView kind={m.kind} />
        </Marker>
      ))}
    </MapView>
  );
});

const styles = StyleSheet.create({
  unavailable: { ...StyleSheet.absoluteFill, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl, paddingBottom: 200 },
  vehicle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.ink,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  delivery: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickup: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 4, borderColor: colors.ink },
});
