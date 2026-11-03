import { MapPinOff } from 'lucide-react-native';
import { memo, type ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { MAP_UNAVAILABLE_REASON, mapNativeAvailable } from './nativeMap';
import type { MapCanvasProps } from './types';

// MapLibre yalnızca yerel modül varsa yüklenir; Expo Go'da import anında çökmesin diye tembel require.
const Impl: ComponentType<MapCanvasProps> | null = mapNativeAvailable
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('./MapLibreCanvas') as typeof import('./MapLibreCanvas')).MapLibreCanvas
  : null;

/** AKNA haritası. Yerel harita modülü olmayan derlemede çökmek yerine açıklama gösterir. */
export const MapCanvas = memo(function MapCanvas(props: MapCanvasProps) {
  if (Impl) return <Impl {...props} />;
  return (
    <View style={styles.unavailable}>
      <MapPinOff size={28} color={colors.textTertiary} />
      <Text variant="subheading" align="center">
        Harita kullanılamıyor
      </Text>
      <Text variant="bodySmall" tone="secondary" align="center">
        {MAP_UNAVAILABLE_REASON}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  unavailable: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    paddingBottom: 220,
  },
});
