import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, spacing } from '@/theme';

/** Tipografik AKNA Transport logosu. lineHeight yazı boyutundan küçük olursa iOS harflerin üstünü kırpar. */
export const BrandMark = memo(function BrandMark({ size = 'lg', tone = 'inverse' }: { size?: 'md' | 'lg'; tone?: 'inverse' | 'default' }) {
  const big = size === 'lg';
  const fg = tone === 'inverse' ? colors.textInverse : colors.text;
  return (
    <View style={styles.wrap} accessibilityRole="header" accessibilityLabel="AKNA Transport">
      <Text style={[styles.word, { color: fg, fontSize: big ? 40 : 26, lineHeight: big ? 48 : 32, letterSpacing: big ? 10 : 6 }]}>AKNA</Text>
      <View style={styles.row}>
        <View style={[styles.rule, { backgroundColor: tone === 'inverse' ? colors.inkLine : colors.borderStrong }]} />
        <Text variant="caption" style={{ color: tone === 'inverse' ? colors.textInverseMuted : colors.textSecondary, letterSpacing: big ? 5 : 3.5 }}>
          TRANSPORT
        </Text>
        <View style={[styles.rule, { backgroundColor: tone === 'inverse' ? colors.inkLine : colors.borderStrong }]} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.xs },
  word: { fontWeight: '800', marginRight: -10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rule: { width: 18, height: 1 },
});
