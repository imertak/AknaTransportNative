import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';
import { Text } from './Text';

/** Etiket–değer satırı (detay ekranları). */
export const InfoRow = memo(function InfoRow({ label, value, icon: Icon, onPress, last }: { label: string; value: ReactNode; icon?: LucideIcon; onPress?: () => void; last?: boolean }) {
  const content = (
    <View style={[styles.infoRow, !last && styles.infoBorder]}>
      {Icon ? <Icon size={18} color={colors.textTertiary} strokeWidth={1.9} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodySmall" tone="tertiary">{label}</Text>
        {typeof value === 'string' || typeof value === 'number' ? <Text variant="body">{value || '—'}</Text> : value}
      </View>
      {onPress ? <ChevronRight size={18} color={colors.textTertiary} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {content}
    </Pressable>
  );
});

/** Dashboard ve özet kartlarındaki sayı kutusu. */
export const StatTile = memo(function StatTile({ label, value, hint, onPress, emphasis }: { label: string; value: string | number; hint?: string; onPress?: () => void; emphasis?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [styles.tile, emphasis && styles.tileEmphasis, pressed && { opacity: 0.85 }]}>
      <Text variant="bodySmall" tone={emphasis ? 'inverseMuted' : 'secondary'} numberOfLines={1}>
        {label}
      </Text>
      <Text variant="number" tone={emphasis ? 'inverse' : 'default'} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint ? <Text variant="bodySmall" tone={emphasis ? 'inverseMuted' : 'tertiary'} numberOfLines={1}>{hint}</Text> : null}
    </Pressable>
  );
});

/** Liste satırı (profil menüsü, ayarlar). */
export const ListItem = memo(function ListItem({ icon: Icon, title, subtitle, onPress, right, destructive }: { icon?: LucideIcon; title: string; subtitle?: string; onPress?: () => void; right?: ReactNode; destructive?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button" style={({ pressed }) => [styles.listItem, pressed && { backgroundColor: colors.surfaceMuted }]}>
      {Icon ? (
        <View style={styles.listIcon}>
          <Icon size={18} color={destructive ? colors.danger : colors.text} strokeWidth={1.9} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text variant="subheading" tone={destructive ? 'danger' : 'default'}>{title}</Text>
        {subtitle ? <Text variant="bodySmall" tone="secondary">{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={18} color={colors.textTertiary} /> : null)}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  infoBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong },
  tile: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  tileEmphasis: { backgroundColor: colors.ink, borderColor: colors.ink },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2 },
  listIcon: { width: 36, height: 36, borderRadius: radius.sm + 2, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
});
