import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { Text } from './Text';

export type BadgeTone = 'neutral' | 'strong' | 'solid' | 'outline' | 'muted' | 'danger';

const TONES: Record<BadgeTone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: colors.surfaceSunken, fg: colors.textSecondary, border: colors.surfaceSunken },
  strong: { bg: colors.borderStrong, fg: colors.text, border: colors.borderStrong },
  solid: { bg: colors.ink, fg: colors.textInverse, border: colors.ink },
  outline: { bg: colors.surface, fg: colors.text, border: colors.text },
  muted: { bg: 'transparent', fg: colors.textTertiary, border: colors.border },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
};

interface Props {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Badge = memo(function Badge({ label, tone = 'neutral', dot, style }: Props) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border }, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: t.fg }]} /> : null}
      <Text variant="label" style={{ color: t.fg, fontSize: 12 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
