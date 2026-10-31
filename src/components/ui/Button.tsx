import type { LucideIcon } from 'lucide-react-native';
import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

const V: Record<Variant, { bg: string; fg: string; border: string; pressed: string }> = {
  primary: { bg: colors.ink, fg: colors.textInverse, border: colors.ink, pressed: colors.inkPressed },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.borderStrong, pressed: colors.surfaceSunken },
  ghost: { bg: 'transparent', fg: colors.text, border: 'transparent', pressed: colors.surfaceSunken },
  danger: { bg: colors.surface, fg: colors.danger, border: colors.dangerBorder, pressed: colors.dangerSoft },
  inverse: { bg: colors.surface, fg: colors.text, border: colors.surface, pressed: colors.surfaceSunken },
};

const S: Record<Size, { h: number; px: number; icon: number }> = {
  sm: { h: 36, px: spacing.md, icon: 16 },
  md: { h: 46, px: spacing.lg, icon: 18 },
  lg: { h: 54, px: spacing.xl, icon: 20 },
};

export const Button = memo(function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading,
  disabled,
  fullWidth,
  style,
  accessibilityHint,
}: ButtonProps) {
  const v = V[variant];
  const s = S[size];
  const inactive = disabled || loading;
  const iconEl = Icon ? <Icon size={s.icon} color={v.fg} strokeWidth={2} /> : null;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        { height: s.h, paddingHorizontal: s.px, backgroundColor: pressed ? v.pressed : v.bg, borderColor: v.border },
        fullWidth && styles.full,
        inactive && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        <View style={styles.row}>
          {iconPosition === 'left' && iconEl}
          <Text style={[size === 'sm' ? typography.label : typography.subheading, { color: v.fg }]} numberOfLines={1}>
            {label}
          </Text>
          {iconPosition === 'right' && iconEl}
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  full: { alignSelf: 'stretch' },
  disabled: { opacity: 0.45 },
});
