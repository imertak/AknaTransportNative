import type { LucideIcon } from 'lucide-react-native';
import { Inbox } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';

interface EmptyProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, compact }: EmptyProps) {
  return (
    <View style={[styles.empty, compact && styles.compact]}>
      <View style={styles.iconWrap}>
        <Icon size={22} color={colors.textSecondary} strokeWidth={1.8} />
      </View>
      <Text variant="subheading" align="center">
        {title}
      </Text>
      {description ? (
        <Text variant="bodySmall" tone="secondary" align="center" style={{ maxWidth: 280 }}>
          {description}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.sm }}>{action}</View> : null}
    </View>
  );
}

export function LoadingState({ label = 'Yükleniyor' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityLabel={label} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.ink} />
      <Text variant="bodySmall" tone="tertiary">{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text variant="subheading" align="center">Bir sorun oluştu</Text>
      <Text variant="bodySmall" tone="secondary" align="center">{message}</Text>
      {onRetry ? <Button label="Tekrar dene" variant="secondary" onPress={onRetry} size="sm" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.huge,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  compact: { paddingVertical: spacing.xxl },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xxl },
});
