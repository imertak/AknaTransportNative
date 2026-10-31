import type { LucideIcon } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, hitSlop, radius } from '@/theme';

interface Props {
  icon: LucideIcon;
  onPress: () => void;
  label: string;
  tone?: 'light' | 'dark' | 'plain';
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export const IconButton = memo(function IconButton({ icon: Icon, onPress, label, tone = 'light', size = 40, style }: Props) {
  const dark = tone === 'dark';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size },
        tone === 'light' && styles.light,
        dark && styles.dark,
        pressed && { opacity: 0.7 },
        style,
      ]}>
      <Icon size={20} color={dark ? colors.textInverse : colors.text} strokeWidth={2} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  light: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  dark: { backgroundColor: colors.inkRaised, borderWidth: 1, borderColor: colors.inkLine },
});
