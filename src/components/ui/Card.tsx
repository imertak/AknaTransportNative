import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';

interface Props {
  children: ReactNode;
  onPress?: () => void;
  padded?: boolean;
  tone?: 'surface' | 'ink' | 'muted';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export const Card = memo(function Card({ children, onPress, padded = true, tone = 'surface', style, accessibilityLabel }: Props) {
  const toneStyle = tone === 'ink' ? styles.ink : tone === 'muted' ? styles.muted : styles.surface;
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.base, toneStyle, padded && styles.padded, pressed && styles.pressed, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.base, toneStyle, padded && styles.padded, style]}>{children}</View>;
});

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg, borderWidth: 1 },
  surface: { backgroundColor: colors.surface, borderColor: colors.border },
  muted: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
  ink: { backgroundColor: colors.ink, borderColor: colors.ink },
  padded: { padding: spacing.lg },
  pressed: { opacity: 0.86 },
});
