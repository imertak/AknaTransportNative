import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import type { MonthRow } from '@/utils/monthGroups';
import { Text } from './Text';

/** Aylara bölünmüş listede ay başlığı: solda "Kasım 2026", sağda özet (adet, tutar). */
export const MonthHeader = memo(function MonthHeader({ label, summary, first }: { label: string; summary?: string; first?: boolean }) {
  return (
    <View style={[styles.row, first && styles.first]} accessibilityRole="header">
      <Text variant="subheading">{label}</Text>
      {summary ? (
        <Text variant="bodySmall" tone="tertiary">
          {summary}
        </Text>
      ) : null}
    </View>
  );
});

/** Ay başlığının önünde/arkasında boşluk bırakmayan öğe ayırıcı (FlatList ItemSeparatorComponent). */
export function monthSeparator(height: number) {
  return function MonthSeparator({ leadingItem, trailingItem }: { leadingItem?: MonthRow<unknown>; trailingItem?: MonthRow<unknown> }) {
    if (leadingItem?.kind !== 'item' || trailingItem?.kind !== 'item') return null;
    return <View style={{ height }} />;
  };
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: spacing.xs, paddingTop: spacing.xl, paddingBottom: spacing.sm },
  first: { paddingTop: spacing.xs },
});
