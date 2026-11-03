import { Marker } from '@maplibre/maplibre-react-native';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors } from '@/theme';
import type { MapStop } from './types';

interface Props extends MapStop {
  onPress?: (id: string) => void;
}

/**
 * Durak işaretçisi. Yükleme: siyah daire, teslimat: beyaz kare (siyah kenarlı). İçindeki numara
 * güzergâhtaki sırayı gösterir.
 */
export const StopMarker = memo(function StopMarker({ id, kind, order, coordinate, title, done, onPress }: Props) {
  const pickup = kind === 'pickup';
  return (
    <Marker id={`stop-${id}`} lngLat={[coordinate.longitude, coordinate.latitude]} anchor="center" onPress={() => onPress?.(id)}>
      <View
        accessibilityRole="button"
        accessibilityLabel={`${order}. durak, ${title}`}
        style={[styles.base, pickup ? styles.pickup : styles.delivery, done && styles.done]}>
        <Text variant="caption" style={[styles.text, { color: pickup ? colors.textInverse : colors.text }]}>
          {order}
        </Text>
      </View>
    </Marker>
  );
});

const styles = StyleSheet.create({
  base: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2, elevation: 3 },
  pickup: { borderRadius: 13, backgroundColor: colors.ink, borderColor: colors.surface },
  delivery: { borderRadius: 6, backgroundColor: colors.surface, borderColor: colors.ink },
  done: { opacity: 0.45 },
  text: { fontSize: 12, lineHeight: 14, letterSpacing: 0, textTransform: 'none' },
});
