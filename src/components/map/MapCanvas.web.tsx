import { MapPinned } from 'lucide-react-native';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, spacing } from '@/theme';
import type { MapCanvasProps } from './types';

/** Web önizlemesinde yerel MapLibre bileşeni yoktur; araçlar ve duraklar liste olarak gösterilir. */
export const MapCanvas = memo(function MapCanvas({ vehicles = [], stops = [] }: MapCanvasProps) {
  return (
    <View style={styles.wrap}>
      <MapPinned size={28} color={colors.textTertiary} />
      <Text variant="subheading">Harita mobil uygulamada görüntülenir</Text>
      {vehicles.map((v) => (
        <Text key={v.id} variant="bodySmall" tone="secondary">
          {v.label ?? 'Araç'}: {v.coordinate.latitude.toFixed(4)}, {v.coordinate.longitude.toFixed(4)}
          {v.stale ? ' (eski konum)' : ''}
        </Text>
      ))}
      {stops.map((s) => (
        <Text key={s.id} variant="bodySmall" tone="tertiary">
          {s.order}. {s.title}
        </Text>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFill, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
});
