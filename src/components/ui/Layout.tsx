import { memo, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useBottomInset } from '@/hooks/useBottomInset';

import { colors, spacing } from '@/theme';
import { InfoTip } from './InfoTip';
import { Text } from './Text';

export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

/** Odaklanan input'un klavyenin üstünde kalması için klavyeden bırakılan boşluk. */
export const KEYBOARD_INPUT_OFFSET = spacing.xxl;

/**
 * Kaydırılabilir içerik alanı (formlar ve detaylar için). Bir input'a dokunulduğunda ekran kayar ve input
 * klavyenin hemen üstüne gelir; Android'de pencere klavyeyle küçülmediği için bu iş burada yapılır.
 */
export function ScrollContent({ children, contentStyle }: { children: ReactNode; contentStyle?: StyleProp<ViewStyle> }) {
  return (
    <KeyboardAwareScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, contentStyle]}
      bottomOffset={KEYBOARD_INPUT_OFFSET}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      showsVerticalScrollIndicator={false}>
      {children}
    </KeyboardAwareScrollView>
  );
}

/** Ekranın altında sabit aksiyon alanı. */
export function BottomBar({ children }: { children: ReactNode }) {
  const bottom = useBottomInset();
  return <View style={[styles.bottomBar, { paddingBottom: Math.max(bottom, spacing.md) }]}>{children}</View>;
}

interface SectionProps {
  title?: string;
  /** Başlığın yanında "i" ikonuyla açılan açıklama. */
  info?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const Section = memo(function Section({ title, info, action, children, style }: SectionProps) {
  return (
    <View style={[styles.section, style]}>
      {title || action ? (
        <View style={styles.sectionHead}>
          {title ? (
            <View style={styles.titleRow}>
              <Text variant="caption" tone="tertiary">{title}</Text>
              {info ? <InfoTip text={info} label={`${title} hakkında`} size={14} /> : null}
            </View>
          ) : (
            <View />
          )}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
});

export const Divider = ({ inset = 0 }: { inset?: number }) => <View style={[styles.divider, { marginLeft: inset }]} />;

export const Row = ({ children, gap = spacing.sm, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
);

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.huge, gap: spacing.xl },
  bottomBar: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  section: { gap: spacing.sm + 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xs, minHeight: 20 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
});
