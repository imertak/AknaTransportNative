import { ArrowDownLeft, ArrowUpRight, FilePlus2, ReceiptText } from 'lucide-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import type { LedgerEntry, LedgerKind } from '@/services/accounts';
import { colors, spacing } from '@/theme';
import { formatCurrency, formatDate } from '@/utils/format';

const ICON: Record<LedgerKind, typeof ReceiptText> = {
  Invoice: ReceiptText,
  Collection: ArrowDownLeft,
  Refund: ArrowUpRight,
  Charge: FilePlus2,
};

/** Cari ekstre satırı: borç (+) veya alacak (−) ve satır sonrası bakiye. */
export const LedgerRow = memo(function LedgerRow({ entry, onPress, last }: { entry: LedgerEntry; onPress?: (e: LedgerEntry) => void; last?: boolean }) {
  const Icon = ICON[entry.kind];
  const incoming = entry.credit > 0;
  const amount = incoming ? entry.credit : entry.debit;
  const meta = [formatDate(entry.date), entry.method, entry.description].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress ? () => onPress(entry) : undefined}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, !last && styles.border, pressed && { backgroundColor: colors.surfaceMuted }]}>
      <View style={[styles.icon, incoming && styles.iconIn]}>
        <Icon size={16} color={incoming ? colors.textInverse : colors.text} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subheading" numberOfLines={1}>{entry.title}</Text>
        <Text variant="bodySmall" tone="secondary" numberOfLines={1}>{meta}</Text>
      </View>
      <View style={styles.amounts}>
        <Text variant="subheading">{`${incoming ? '−' : '+'}${formatCurrency(amount, { decimals: 2 })}`}</Text>
        <Text variant="caption" tone="tertiary">Bakiye {formatCurrency(entry.balance, { decimals: 2 })}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  icon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  iconIn: { backgroundColor: colors.ink },
  amounts: { alignItems: 'flex-end', gap: 2 },
});
