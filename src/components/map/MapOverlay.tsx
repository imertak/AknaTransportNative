import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

/** Harita üzerinde yüzen başlık. */
export function MapTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.title, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
      <View style={styles.titleCard}>
        <View style={{ flex: 1 }}>
          <Text variant="heading" tone="inverse">{title}</Text>
          {subtitle ? <Text variant="bodySmall" tone="inverseMuted" numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

export function MapPanel({ children }: { children: ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

const styles = StyleSheet.create({
  title: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  titleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
});
