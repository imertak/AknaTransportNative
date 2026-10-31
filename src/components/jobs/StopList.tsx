import { MapPinCheck, Navigation } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, hitSlop, spacing } from '@/theme';
import type { JobStop } from '@/types';
import { openDirections } from '@/utils/links';
import { orderStops } from '@/utils/stops';

/** İşin tüm durakları: önce yüklemeler, sonra teslimatlar (sıra numarasıyla). */
export const StopList = memo(function StopList({ stops, navigable }: { stops: JobStop[]; navigable?: boolean }) {
  const ordered = orderStops(stops);
  return (
    <View>
      {ordered.map((s, i) => {
        const last = i === ordered.length - 1;
        return (
          <View key={s.id ?? `${s.type}-${s.sequence}`} style={styles.row}>
            <View style={styles.rail}>
              <View style={s.type === 'pickup' ? styles.circle : styles.square} />
              {!last ? <View style={styles.line} /> : null}
            </View>
            <View style={[styles.body, !last && { paddingBottom: spacing.md }]}>
              <Text variant="caption" tone="tertiary">
                {s.type === 'pickup' ? 'Yükleme' : 'Teslimat'} {s.sequence}
                {s.point ? ' · konum kayıtlı' : ''}
              </Text>
              <Text>{s.address}</Text>
              {s.description ? <Text variant="bodySmall" tone="secondary">{s.description}</Text> : null}
            </View>
            {navigable ? (
              <Pressable
                onPress={() => openDirections(s.address, s.point)}
                hitSlop={hitSlop}
                style={styles.nav}
                accessibilityRole="button"
                accessibilityLabel={`${s.address} için yol tarifi`}>
                {s.point ? <MapPinCheck size={18} color={colors.text} /> : <Navigation size={18} color={colors.text} />}
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: 12, paddingTop: 4 },
  circle: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface },
  square: { width: 11, height: 11, borderRadius: 2, backgroundColor: colors.ink },
  line: { flex: 1, width: 1.5, backgroundColor: colors.borderStrong, marginTop: 3 },
  body: { flex: 1, gap: 2 },
  nav: { padding: spacing.xs },
});
