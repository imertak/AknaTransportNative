import { memo, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';
import { Text } from './Text';

export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

/** Klavye uyumlu kaydırılabilir içerik alanı (formlar ve detaylar için). */
export function ScrollContent({ children, keyboard, contentStyle }: { children: ReactNode; keyboard?: boolean; contentStyle?: StyleProp<ViewStyle> }) {
  const content = (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
  if (!keyboard) return content;
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {content}
    </KeyboardAvoidingView>
  );
}

/** Ekranın altında sabit aksiyon alanı. */
export function BottomBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>{children}</View>;
}

interface SectionProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const Section = memo(function Section({ title, action, children, style }: SectionProps) {
  return (
    <View style={[styles.section, style]}>
      {title || action ? (
        <View style={styles.sectionHead}>
          {title ? <Text variant="caption" tone="tertiary">{title}</Text> : <View />}
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
