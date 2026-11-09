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
 * Durak işaretçisi. Yükleme: siyah daire, teslimat: beyaz kare (siyah kenarlı). Aracın gittiği durak
 * turuncu daire ve hale ile gösterilir. İçindeki numara güzergâhtaki sırayı gösterir.
 */
export const StopMarker = memo(function StopMarker({ id, kind, order, coordinate, title, done, target, onPress }: Props) {
  const pickup = kind === 'pickup';
  const label = `${order}. durak, ${title}${target ? ', gidilen nokta' : ''}`;
  return (
    <Marker id={`stop-${id}`} lngLat={[coordinate.longitude, coordinate.latitude]} anchor="center" onPress={() => onPress?.(id)}>
      {target ? (
        <View accessibilityRole="button" accessibilityLabel={label} style={styles.halo}>
          <View style={[styles.base, styles.target]}>
            <Text variant="caption" style={[styles.text, { color: colors.textInverse }]}>
              {order}
            </Text>
          </View>
        </View>
      ) : (
        <View accessibilityRole="button" accessibilityLabel={label} style={[styles.base, pickup ? styles.pickup : styles.delivery, done && styles.done]}>
          <Text variant="caption" style={[styles.text, { color: pickup ? colors.textInverse : colors.text }]}>
            {order}
          </Text>
        </View>
      )}
    </Marker>
  );
});

const styles = StyleSheet.create({
  base: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2, elevation: 3 },
  pickup: { borderRadius: 13, backgroundColor: colors.ink, borderColor: colors.surface },
  delivery: { borderRadius: 6, backgroundColor: colors.surface, borderColor: colors.ink },
  done: { opacity: 0.45 },
  halo: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.destinationHalo },
  target: { borderRadius: 13, backgroundColor: colors.destination, borderColor: colors.surface },
  text: { fontSize: 12, lineHeight: 14, letterSpacing: 0, textTransform: 'none' },
});
