import { MapPinned } from 'lucide-react-native';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, spacing } from '@/theme';
import type { MapCanvasProps } from './types';

/** Web önizlemesinde yerel harita bileşeni yoktur; konumlar liste olarak gösterilir. */
export const MapCanvas = memo(function MapCanvas({ markers }: MapCanvasProps) {
  return (
    <View style={styles.wrap}>
      <MapPinned size={28} color={colors.textTertiary} />
      <Text variant="subheading">Harita mobil uygulamada görüntülenir</Text>
      {markers.map((m) => (
        <Text key={m.id} variant="bodySmall" tone="secondary">
          {m.title}: {m.coordinate.latitude.toFixed(4)}, {m.coordinate.longitude.toFixed(4)}
        </Text>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFill, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
});
