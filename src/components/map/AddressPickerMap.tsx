import { Camera, Map, Marker, type CameraRef } from '@maplibre/maplibre-react-native';
import { MapPin } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';
import { mapStyle } from '@/theme/map';
import type { GeoPoint } from '@/types';

export interface AddressPickerMapProps {
  center: GeoPoint;
  pin: GeoPoint | null;
  /** Değiştiğinde kamera bu noktaya uçar (adres arama sonucu). */
  focus: GeoPoint | null;
  label: string;
  onPress: (p: GeoPoint) => void;
}

/** Adres seçici haritası (MapLibre). Yalnızca yerel modül varken yüklenir. */
export function AddressPickerMap({ center, pin, focus, label, onPress }: AddressPickerMapProps) {
  const camera = useRef<CameraRef>(null);
  useEffect(() => {
    if (focus) camera.current?.flyTo({ center: [focus.longitude, focus.latitude], zoom: 16, duration: 600 });
  }, [focus]);

  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={mapStyle}
      logo={false}
      compass={false}
      touchRotate={false}
      touchPitch={false}
      attributionPosition={{ bottom: 8, left: 8 }}
      onPress={(e) => {
        const [longitude, latitude] = e.nativeEvent.lngLat;
        onPress({ latitude, longitude });
      }}>
      <Camera ref={camera} initialViewState={{ center: [center.longitude, center.latitude], zoom: pin ? 16 : 10 }} />
      {pin ? (
        <Marker id="address-pin" lngLat={[pin.longitude, pin.latitude]} anchor="bottom">
          <View accessibilityLabel={label}>
            <MapPin size={36} color={colors.surface} fill={colors.ink} strokeWidth={1.5} />
          </View>
        </Marker>
      ) : null}
    </Map>
  );
}
