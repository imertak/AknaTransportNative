import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, spacing } from '@/theme';

/** Yükleme → teslimat güzergahı. Daire: yükleme, kare: teslimat. */
/** extraStops: ilk yükleme ve son teslimat dışındaki durak sayısı (çok duraklı işler). */
export const RouteLine = memo(function RouteLine({ pickup, delivery, compact, extraStops = 0 }: { pickup: string; delivery: string; compact?: boolean; extraStops?: number }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.rail}>
        <View style={styles.circle} />
        <View style={styles.line} />
        <View style={styles.square} />
      </View>
      <View style={styles.texts}>
        <View>
          {!compact ? <Text variant="caption" tone="tertiary">Yükleme</Text> : null}
          <Text variant={compact ? 'bodySmall' : 'body'} numberOfLines={compact ? 1 : 3}>{pickup}</Text>
          {extraStops > 0 ? <Text variant="bodySmall" tone="tertiary">+{extraStops} ara durak</Text> : null}
        </View>
        <View>
          {!compact ? <Text variant="caption" tone="tertiary">Teslimat</Text> : null}
          <Text variant={compact ? 'bodySmall' : 'body'} numberOfLines={compact ? 1 : 3}>{delivery}</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', paddingVertical: 5, width: 10 },
  circle: { width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: colors.ink },
  line: { flex: 1, width: 1.5, backgroundColor: colors.borderStrong, marginVertical: 3, minHeight: 10 },
  square: { width: 9, height: 9, backgroundColor: colors.ink, borderRadius: 1.5 },
  texts: { flex: 1, gap: spacing.sm, justifyContent: 'space-between' },
});
